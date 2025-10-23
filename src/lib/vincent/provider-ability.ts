/**
 * VincentProvider - EIP-1193 Provider implementation with Vincent Ability SDK
 * Enables Vincent PKP wallets to be used with Nexus SDK and other Web3 libraries
 *
 * CRITICAL: This provider signs transactions using Vincent's EVM transaction signer ability,
 * NOT directly with app's private key. Transactions are signed by user's PKP wallet.
 */

import { EventEmitter } from 'events';
import { getEvmTxSignerClient } from './abilityClient';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { VINCENT_CONFIG } from './config';
import { loggers } from '@/lib/utils/logger';
import { createPublicClient, http, serializeTransaction, parseTransaction } from 'viem';
import type { Chain, EIP1193Provider } from 'viem';

const logger = loggers.vincent;

/**
 * VincentProvider Configuration
 */
export interface VincentProviderConfig {
  walletAddress: string; // User's PKP wallet address from JWT
  chainId: number;
}

/**
 * VincentProvider implements EIP-1193 provider interface
 * Signs transactions using Vincent PKP (NOT app wallet)
 */
export class VincentProviderAbility extends EventEmitter implements EIP1193Provider {
  private walletAddress: string;
  private chainId: number;
  private rpcUrl: string;
  private chain: Chain;
  private connected: boolean = false;

  constructor(config: VincentProviderConfig) {
    super();

    this.walletAddress = config.walletAddress;
    this.chainId = config.chainId;
    this.rpcUrl = this.getRpcUrl(config.chainId);
    this.chain = this.getChainConfig(config.chainId);

    logger.info(
      {
        walletAddress: this.walletAddress,
        chainId: this.chainId,
      },
      'VincentProvider initialized with ability SDK'
    );

    // Auto-connect
    this.connect();
  }

  private getRpcUrl(chainId: number): string {
    if (chainId === 11155111) {
      return VINCENT_CONFIG.chains.ethereumSepolia.rpcUrl;
    } else if (chainId === 421614) {
      return VINCENT_CONFIG.chains.arbitrumSepolia.rpcUrl;
    } else {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
  }

  private getChainConfig(chainId: number): Chain {
    const chains: Record<number, Chain> = {
      11155111: {
        id: 11155111,
        name: 'Ethereum Sepolia',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [this.rpcUrl] },
          public: { http: [this.rpcUrl] },
        },
        testnet: true,
      },
      421614: {
        id: 421614,
        name: 'Arbitrum Sepolia',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [this.rpcUrl] },
          public: { http: [this.rpcUrl] },
        },
        testnet: true,
      },
    };

    const chain = chains[chainId];
    if (!chain) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    return chain;
  }

  /**
   * EIP-1193 request method
   * Handles standard Ethereum JSON-RPC methods
   */
  async request({ method, params }: { method: string; params?: any[] }): Promise<any> {
    logger.debug({ method, params }, 'Provider request');

    try {
      switch (method) {
        // Account methods
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [this.walletAddress];

        case 'eth_chainId':
          return `0x${this.chainId.toString(16)}`;

        case 'net_version':
          return this.chainId.toString();

        // Transaction sending (CRITICAL SECTION)
        case 'eth_sendTransaction':
          return await this.handleSendTransaction(params as any[]);

        // Read-only methods - proxy to RPC
        case 'eth_getBalance':
        case 'eth_getTransactionCount':
        case 'eth_call':
        case 'eth_estimateGas':
        case 'eth_getCode':
        case 'eth_getStorageAt':
        case 'eth_blockNumber':
        case 'eth_getBlockByNumber':
        case 'eth_getBlockByHash':
        case 'eth_getTransactionByHash':
        case 'eth_getTransactionReceipt':
        case 'eth_getLogs':
          return await this.proxyToRpc(method, params);

        default:
          throw new Error(`Method not supported: ${method}`);
      }
    } catch (error) {
      logger.error({ err: error, method }, 'Provider request failed');
      throw error;
    }
  }

  /**
   * Handle eth_sendTransaction
   *
   * CRITICAL: Uses Vincent EVM transaction signer ability
   * Signs with user's PKP wallet, NOT app wallet
   */
  private async handleSendTransaction(params: any[]): Promise<string> {
    const [txParams] = params;

    logger.info({ txParams }, 'Signing transaction via Vincent PKP');

    /**
     * CRITICAL: Vincent EVM Transaction Signing
     *
     * This is the correct way to sign transactions:
     * 1. Serialize unsigned transaction (viem)
     * 2. Call Vincent EVM transaction signer ability
     *    - Vincent signs using user's delegated PKP (NOT app wallet)
     *    - Uses JWT authorization from user
     * 3. Broadcast the signed transaction
     *
     * Why this works:
     * - User authorized app via JWT to act as delegatee
     * - Vincent ability uses Lit Actions to sign with PKP
     * - Transaction broadcasts from user's PKP wallet address
     * - App never directly controls user's private keys
     */

    // Step 1: Serialize unsigned transaction
    const unsignedTx = {
      to: txParams.to as `0x${string}`,
      value: txParams.value ? BigInt(txParams.value) : 0n,
      data: (txParams.data || '0x') as `0x${string}`,
      gas: txParams.gas ? BigInt(txParams.gas) : undefined,
      gasPrice: txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined,
      maxFeePerGas: txParams.maxFeePerGas ? BigInt(txParams.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: txParams.maxPriorityFeePerGas
        ? BigInt(txParams.maxPriorityFeePerGas)
        : undefined,
      nonce: txParams.nonce ? Number(txParams.nonce) : undefined,
      chainId: this.chainId,
    };

    const serializedTx = serializeTransaction(unsignedTx);

    logger.info(
      {
        to: txParams.to,
        value: txParams.value,
        chainId: this.chainId,
      },
      'Step 1: Transaction serialized'
    );

    // Step 2: Call Vincent EVM transaction signer ability
    logger.info('Step 2: Calling Vincent EVM transaction signer ability');

    const evmSignerClient = getEvmTxSignerClient();

    const signResult = await evmSignerClient.execute(
      {
        serializedTransaction: serializedTx,
      },
      {
        // CRITICAL: This tells Vincent to sign using the delegated PKP
        // that the user authorized via JWT
        delegatorPkpEthAddress: this.walletAddress,
      }
    );

    if (!signResult.success) {
      logger.error({ signResult }, 'Vincent PKP signing failed');
      throw new Error(
        signResult.result?.error || 'Transaction signing failed via Vincent PKP'
      );
    }

    logger.info(
      {
        signedTxPreview: signResult.result.signedTransaction.slice(0, 20) + '...',
      },
      'Step 2 complete: Transaction signed by Vincent PKP'
    );

    // Step 3: Broadcast signed transaction
    logger.info('Step 3: Broadcasting signed transaction');

    const publicClient = createPublicClient({
      transport: http(this.rpcUrl),
      chain: this.chain,
    });

    const txHash = await publicClient.sendRawTransaction({
      serializedTransaction: signResult.result.signedTransaction as `0x${string}`,
    });

    logger.info(
      {
        txHash,
        from: this.walletAddress,
        to: txParams.to,
      },
      'Step 3 complete: Transaction broadcasted successfully'
    );

    return txHash;
  }

  /**
   * Proxy read-only methods to RPC
   */
  private async proxyToRpc(method: string, params?: any[]): Promise<any> {
    const publicClient = createPublicClient({
      transport: http(this.rpcUrl),
      chain: this.chain,
    });
    return publicClient.request({ method: method as any, params } as any);
  }

  /**
   * Connect the provider
   * Emits 'connect' event
   */
  private connect(): void {
    if (this.connected) {
      return;
    }

    this.connected = true;

    logger.info(
      {
        walletAddress: this.walletAddress,
        chainId: this.chainId,
      },
      'Provider connected'
    );

    // Emit connect event per EIP-1193
    this.emit('connect', {
      chainId: `0x${this.chainId.toString(16)}`,
    });
  }

  /**
   * Disconnect the provider
   * Emits 'disconnect' event
   */
  disconnect(): void {
    if (!this.connected) {
      return;
    }

    this.connected = false;

    logger.info('Provider disconnected');

    // Emit disconnect event per EIP-1193
    this.emit('disconnect', {
      code: 1000,
      message: 'Provider disconnected',
    });
  }

  /**
   * Check if provider is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the current chain ID
   */
  getChainId(): number {
    return this.chainId;
  }

  /**
   * Get the wallet address
   */
  getWalletAddress(): string {
    return this.walletAddress;
  }
}

/**
 * Factory function to create a VincentProvider for Nexus SDK
 *
 * @param config - Provider configuration
 * @returns EIP-1193 provider that signs using Vincent PKP
 */
export async function createVincentProviderForNexus(config: {
  walletAddress: string;
  chainId: number;
}): Promise<EIP1193Provider> {
  return new VincentProviderAbility(config);
}
