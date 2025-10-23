/**
 * VincentProvider - EIP-1193 Provider implementation for Vincent PKP wallets
 * Enables Vincent wallets to be used with Nexus SDK and other Web3 libraries
 */

import { EventEmitter } from 'events';
import { VincentWalletService } from './wallet.service';
import { VincentSigner } from './signer';
import { loggers } from '@/lib/utils/logger';
import { ethers } from 'ethers';

const logger = loggers.vincent;

/**
 * EIP-1193 request arguments
 */
interface RequestArguments {
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

/**
 * VincentProvider implements EIP-1193 provider interface
 * Required by Nexus SDK for wallet interactions
 */
export class VincentProvider extends EventEmitter {
  private agentId: string;
  private vincentService: VincentWalletService;
  private signer: VincentSigner;
  private chainId: number;
  private connected: boolean = false;

  constructor(
    agentId: string,
    chainId: number = 84532, // Base Sepolia default
    vincentService?: VincentWalletService
  ) {
    super();
    this.agentId = agentId;
    this.chainId = chainId;
    this.vincentService = vincentService || new VincentWalletService();
    this.signer = new VincentSigner(agentId, undefined, this.vincentService);

    // Auto-connect on instantiation
    this.connect();
  }

  /**
   * EIP-1193 request method
   * Handles standard Ethereum JSON-RPC methods
   */
  async request(args: RequestArguments): Promise<any> {
    logger.debug({
      agentId: this.agentId,
      method: args.method,
      paramsLength: Array.isArray(args.params) ? args.params.length : 0
    }, 'Provider request');

    try {
      switch (args.method) {
        case 'eth_accounts':
        case 'eth_requestAccounts':
          return await this.handleAccountsRequest();

        case 'eth_chainId':
          return this.handleChainIdRequest();

        case 'personal_sign':
          return await this.handlePersonalSign(args.params as any[]);

        case 'eth_signTypedData':
        case 'eth_signTypedData_v4':
          return await this.handleSignTypedData(args.params as any[]);

        case 'eth_sendTransaction':
          throw new Error('eth_sendTransaction not supported. Use Nexus SDK for transaction routing.');

        case 'wallet_switchEthereumChain':
          return await this.handleSwitchChain(args.params as any[]);

        default:
          logger.warn({ method: args.method }, 'Unsupported method');
          throw new Error(`Method not supported: ${args.method}`);
      }
    } catch (error) {
      logger.error({
        err: error,
        method: args.method,
        agentId: this.agentId
      }, 'Provider request failed');
      throw error;
    }
  }

  /**
   * Handle eth_accounts / eth_requestAccounts
   */
  private async handleAccountsRequest(): Promise<string[]> {
    try {
      const address = await this.signer.getAddress();
      logger.debug({ agentId: this.agentId, address }, 'Accounts requested');
      return [address];
    } catch (error) {
      logger.error({ err: error, agentId: this.agentId }, 'Failed to get accounts');
      throw error;
    }
  }

  /**
   * Handle eth_chainId
   */
  private handleChainIdRequest(): string {
    // Return as hex string per EIP-1193
    return '0x' + this.chainId.toString(16);
  }

  /**
   * Handle personal_sign
   * @param params - [message, address]
   */
  private async handlePersonalSign(params: any[]): Promise<string> {
    if (!params || params.length < 1) {
      throw new Error('personal_sign requires message parameter');
    }

    const message = params[0];
    logger.debug({
      agentId: this.agentId,
      messageLength: typeof message === 'string' ? message.length : 0
    }, 'Signing message (personal_sign)');

    return await this.signer.signMessage(message);
  }

  /**
   * Handle eth_signTypedData_v4
   * @param params - [address, typedData]
   */
  private async handleSignTypedData(params: any[]): Promise<string> {
    if (!params || params.length < 2) {
      throw new Error('eth_signTypedData requires address and typedData parameters');
    }

    const [_address, typedDataJson] = params;
    const typedData = typeof typedDataJson === 'string'
      ? JSON.parse(typedDataJson)
      : typedDataJson;

    logger.debug({
      agentId: this.agentId,
      domainName: typedData.domain?.name
    }, 'Signing typed data (EIP-712)');

    return await this.signer.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );
  }

  /**
   * Handle wallet_switchEthereumChain
   * @param params - [{ chainId: '0x...' }]
   */
  private async handleSwitchChain(params: any[]): Promise<null> {
    if (!params || params.length < 1 || !params[0].chainId) {
      throw new Error('wallet_switchEthereumChain requires chainId parameter');
    }

    const newChainId = parseInt(params[0].chainId, 16);

    if (newChainId === this.chainId) {
      return null; // Already on requested chain
    }

    logger.info({
      agentId: this.agentId,
      oldChainId: this.chainId,
      newChainId
    }, 'Switching chain');

    const oldChainId = this.chainId;
    this.chainId = newChainId;

    // Emit chainChanged event
    this.emit('chainChanged', '0x' + newChainId.toString(16));

    return null;
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

    logger.info({
      agentId: this.agentId,
      chainId: this.chainId
    }, 'Provider connected');

    // Emit connect event per EIP-1193
    this.emit('connect', {
      chainId: '0x' + this.chainId.toString(16)
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

    logger.info({ agentId: this.agentId }, 'Provider disconnected');

    // Emit disconnect event per EIP-1193
    this.emit('disconnect', {
      code: 1000,
      message: 'Provider disconnected'
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
   * Get the agent ID associated with this provider
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Get the underlying VincentSigner
   */
  getSigner(): VincentSigner {
    return this.signer;
  }
}

/**
 * Factory function to create a VincentProvider for an agent
 */
export function createVincentProvider(
  agentId: string,
  chainId?: number,
  vincentService?: VincentWalletService
): VincentProvider {
  return new VincentProvider(agentId, chainId, vincentService);
}
