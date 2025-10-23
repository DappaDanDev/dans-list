/**
 * Vincent Wallet Ability Service
 *
 * Extends VincentWalletService with Vincent Ability SDK support
 * Implements PyUSD → USDC swaps and other blockchain operations
 */

import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { getSignedUniswapQuote } from '@lit-protocol/vincent-ability-uniswap-swap';
import { getUniswapSwapClient } from './abilityClient';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { VINCENT_CONFIG } from './config';
import { loggers } from '@/lib/utils/logger';
import { ethers } from 'ethers';

const logger = loggers.vincent;

/**
 * Vincent Wallet Ability Service
 *
 * Handles Vincent Ability operations (swaps, approvals, etc.)
 * Uses VincentAuth from database for PKP wallet addresses
 */
export class VincentWalletAbilityService {
  private litClient: LitNodeClient | null = null;
  private litInitPromise: Promise<LitNodeClient> | null = null;

  constructor() {
    logger.info('VincentWalletAbilityService initialized');
  }

  /**
   * Ensure LitNodeClient is connected
   * Shared client instance for all operations
   */
  private async ensureLitConnection(): Promise<LitNodeClient> {
    if (this.litClient?.ready) {
      logger.debug('Using existing Lit client connection');
      return this.litClient;
    }

    if (this.litInitPromise) {
      logger.debug('Waiting for ongoing Lit client initialization');
      return this.litInitPromise;
    }

    this.litInitPromise = this.initLitClient();

    try {
      this.litClient = await this.litInitPromise;
      return this.litClient;
    } finally {
      this.litInitPromise = null;
    }
  }

  /**
   * Initialize Lit Node Client
   */
  private async initLitClient(): Promise<LitNodeClient> {
    logger.info('Initializing Lit Node Client');

    const litNodeClient = new LitNodeClient({
      litNetwork: (process.env.VINCENT_LIT_NETWORK as any) || 'datil-test',
      debug: process.env.NODE_ENV === 'development',
    });

    await litNodeClient.connect();

    logger.info('Successfully connected to Lit Network');
    return litNodeClient;
  }

  /**
   * Get Vincent auth for agent
   * Validates auth exists and not expired
   */
  private async getAuth(agentId: string) {
    const prisma = getPrismaClient();

    const auth = await prisma.vincentAuth.findFirst({
      where: { agentId },
    });

    if (!auth) {
      throw new Error(`No Vincent auth found for agent ${agentId}`);
    }

    if (auth.expiresAt < new Date()) {
      throw new Error(`Vincent auth expired for agent ${agentId}`);
    }

    return auth;
  }

  /**
   * Swap PyUSD → USDC using Uniswap V3
   *
   * Uses Vincent Uniswap swap ability
   * Follows precheck → execute pattern
   *
   * @param agentId - Agent performing swap
   * @param params - Swap parameters
   * @returns Swap result with output amount and tx hash
   */
  async swapPyusdToUsdc(
    agentId: string,
    params: {
      chainId: number;
      amountIn: number; // Human-readable (100 = 100 PYUSD)
      slippageTolerance?: number;
    }
  ): Promise<{
    amountOut: string;
    swapTxHash: string;
  }> {
    const auth = await this.getAuth(agentId);
    const litClient = await this.ensureLitConnection();

    // Get chain config
    const chainConfig =
      params.chainId === 11155111
        ? VINCENT_CONFIG.chains.ethereumSepolia
        : VINCENT_CONFIG.chains.arbitrumSepolia;

    logger.info(
      {
        agentId,
        chainId: params.chainId,
        amountIn: params.amountIn,
      },
      'Starting PyUSD → USDC swap'
    );

    // Step 1: Generate signed Uniswap quote
    logger.debug('Generating signed Uniswap quote');

    const delegateeSigner = new ethers.Wallet(VINCENT_CONFIG.appPrivateKey);

    // Convert human-readable amount to smallest unit (6 decimals for PYUSD)
    const tokenInAmount = (params.amountIn * Math.pow(10, chainConfig.tokens.pyusd.decimals)).toString();

    try {
      const signedQuote = await getSignedUniswapQuote({
        quoteParams: {
          rpcUrl: chainConfig.rpcUrl,
          tokenInAddress: chainConfig.tokens.pyusd.address,
          tokenInAmount,
          tokenOutAddress: chainConfig.tokens.usdc.address,
          recipient: auth.walletAddress,
        },
        ethersSigner: delegateeSigner,
        litNodeClient: litClient,
      });

      logger.info(
        {
          quoteGenerated: true,
          signerEthAddress: signedQuote.signerEthAddress,
        },
        'Uniswap quote generated and signed'
      );

      // Step 2: Execute swap using ability client
      const abilityClient = getUniswapSwapClient();

      logger.debug('Running precheck for swap');

      const precheckResult = await abilityClient.precheck(
        {
          signedUniswapQuote: signedQuote,
        },
        {
          delegatorPkpEthAddress: auth.walletAddress,
        }
      );

      if (!precheckResult.success) {
        logger.error({ precheckResult }, 'Swap precheck failed');
        throw new Error(
          `Swap precheck failed: ${JSON.stringify(precheckResult.result)}`
        );
      }

      logger.info({ precheckResult }, 'Swap precheck passed');

      // Step 3: Execute swap
      logger.debug('Executing swap');

      const executeResult = await abilityClient.execute(
        {
          signedUniswapQuote: signedQuote,
        },
        {
          delegatorPkpEthAddress: auth.walletAddress,
        }
      );

      if (!executeResult.success) {
        logger.error({ executeResult }, 'Swap execution failed');
        throw new Error(
          `Swap failed: ${JSON.stringify(executeResult.result)}`
        );
      }

      logger.info(
        {
          amountOut: executeResult.result.amountOut,
          swapTxHash: executeResult.result.swapTxHash,
        },
        'Swap executed successfully'
      );

      // Store proof of agent action
      const prisma = getPrismaClient();
      await prisma.proof.create({
        data: {
          type: 'AGENT_DECISION',
          hash: executeResult.result.swapTxHash,
          agentId,
          data: {
            action: 'SWAP_PYUSD_TO_USDC',
            params: {
              chainId: params.chainId,
              amountIn: params.amountIn,
              tokenIn: 'PYUSD',
              tokenOut: 'USDC',
            },
            result: executeResult.result,
          } as any,
          signature: executeResult.result.swapTxHash,
          verified: true,
        },
      });

      return {
        amountOut: executeResult.result.amountOut,
        swapTxHash: executeResult.result.swapTxHash,
      };
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to swap PyUSD to USDC');
      throw error;
    }
  }

  /**
   * Get PKP wallet address for agent
   *
   * @param agentId - Agent ID
   * @returns PKP wallet address
   */
  async getWalletAddress(agentId: string): Promise<string> {
    const auth = await this.getAuth(agentId);
    return auth.walletAddress;
  }

  /**
   * Disconnect from Lit Network (cleanup)
   */
  async disconnect(): Promise<void> {
    if (this.litClient) {
      logger.info('Disconnecting from Lit Network');
      await this.litClient.disconnect();
      this.litClient = null;
    }
  }
}
