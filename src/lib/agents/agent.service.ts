/**
 * Agent Service
 *
 * Orchestrates complete purchase flow for autonomous agents
 * Three-step process:
 * 1. Swap PyUSD → USDC (Vincent Uniswap ability)
 * 2. Execute cross-chain USDC transfer (Nexus handles approvals via hooks)
 * 3. Record transaction in database
 */

import { VincentWalletAbilityService } from '@/lib/vincent/wallet-ability.service';
import { NexusService } from '@/lib/nexus/service';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.agents;

/**
 * Purchase parameters
 */
export interface PurchaseParams {
  buyerAgentId: string;
  sellerWalletAddress: string;
  pyusdAmount: number; // Human-readable (100 = 100 PYUSD)
  fromChainId: number; // Source chain for swap (e.g., 11155111 = ETH Sepolia)
  toChainId: number; // Destination chain for transfer (e.g., 421614 = Arbitrum Sepolia)
  listingId: string;
}

/**
 * Purchase result
 */
export interface PurchaseResult {
  success: boolean;
  swapTxHash?: string;
  transferTxHash?: string;
  transferExplorerUrl?: string;
  usdcAmount?: string;
  error?: string;
}

/**
 * Purchase status
 */
export interface PurchaseStatus {
  transaction: any;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
}

/**
 * AgentService handles purchase orchestration for autonomous agents
 *
 * CRITICAL ARCHITECTURE:
 * - Uses VincentWalletAbilityService for PyUSD→USDC swaps
 * - Uses NexusService for cross-chain transfers
 * - All transactions signed by agent's PKP wallet via Vincent
 * - Nexus handles token approvals autonomously via hooks
 */
export class AgentService {
  private walletService: VincentWalletAbilityService;
  private nexusService: NexusService;

  constructor() {
    this.walletService = new VincentWalletAbilityService();
    this.nexusService = new NexusService({ network: 'testnet' });

    logger.info('AgentService initialized');
  }

  /**
   * Execute complete purchase flow
   *
   * Flow:
   * 1. Swap PyUSD → USDC using Vincent Uniswap ability
   *    - Signed by agent's PKP wallet
   *    - Executed on source chain (fromChainId)
   * 2. Execute cross-chain USDC transfer using Nexus
   *    - Nexus SDK initialized with Vincent provider
   *    - Approval hook auto-approves with allow(['min'])
   *    - Nexus executes approval + transfer via Vincent provider
   *    - All transactions signed by agent's PKP wallet
   * 3. Record transaction in database for tracking
   *
   * @param params - Purchase parameters
   * @returns Purchase result with transaction hashes
   */
  async executePurchase(params: PurchaseParams): Promise<PurchaseResult> {
    const {
      buyerAgentId,
      sellerWalletAddress,
      pyusdAmount,
      fromChainId,
      toChainId,
      listingId,
    } = params;

    logger.info({ params }, 'Starting purchase execution');

    try {
      const prisma = getPrismaClient();

      // Get buyer's PKP wallet address
      const buyerWalletAddress = await this.walletService.getWalletAddress(buyerAgentId);

      logger.info(
        {
          buyerAgentId,
          buyerWalletAddress,
          sellerWalletAddress,
        },
        'Buyer and seller wallets identified'
      );

      // ========================================
      // STEP 1: Swap PyUSD → USDC
      // ========================================
      logger.info({ pyusdAmount, fromChainId }, 'Step 1: Swapping PyUSD to USDC');

      const swapResult = await this.walletService.swapPyusdToUsdc(buyerAgentId, {
        chainId: fromChainId,
        amountIn: pyusdAmount,
        slippageTolerance: 0.5, // 0.5% slippage tolerance
      });

      const usdcAmount = swapResult.amountOut;
      const swapTxHash = swapResult.swapTxHash;

      logger.info(
        {
          pyusdIn: pyusdAmount,
          usdcOut: usdcAmount,
          swapTxHash,
        },
        'Step 1 complete: Swap successful'
      );

      // ========================================
      // STEP 2: Execute Cross-Chain Transfer
      // ========================================
      // NOTE: Nexus SDK is initialized automatically in NexusService.getSDK()
      // No manual approval needed - Nexus will:
      // 1. Detect USDC approval needed
      // 2. Call our allowance hook (configured in NexusService)
      // 3. Hook calls allow(['min'])
      // 4. Nexus executes approval tx via VincentProvider
      // 5. VincentProvider calls Vincent EVM tx signer
      // 6. Approval signed by agent's PKP wallet
      // 7. Nexus executes transfer tx

      logger.info(
        {
          usdcAmount,
          from: buyerWalletAddress,
          to: sellerWalletAddress,
          fromChain: fromChainId,
          toChain: toChainId,
        },
        'Step 2: Executing cross-chain USDC transfer (Nexus handles approvals)'
      );

      // Convert USDC amount from smallest unit (6 decimals) to human-readable
      // swapResult.amountOut is in smallest unit (e.g., "95000000" for 95 USDC)
      const usdcAmountHuman = (parseInt(usdcAmount) / 1e6).toString();

      const transferResult = await this.nexusService.executeTransfer({
        fromAgentId: buyerAgentId,
        toAddress: sellerWalletAddress,
        amount: usdcAmountHuman, // Nexus expects human-readable amount
        token: 'USDC',
        destinationChainId: toChainId,
      });

      if (transferResult.status === 'FAILED') {
        throw new Error(transferResult.error || 'Cross-chain transfer failed');
      }

      logger.info(
        {
          explorerUrl: transferResult.explorerUrl,
        },
        'Step 2 complete: Cross-chain transfer initiated'
      );

      // ========================================
      // STEP 3: Record Transaction in Database
      // ========================================
      await prisma.transaction.create({
        data: {
          hash: swapTxHash, // Use swap tx hash as primary identifier
          fromAgentId: buyerAgentId,
          listingId,
          amount: BigInt(usdcAmount), // Store in smallest unit
          token: 'USDC',
          sourceChain: fromChainId,
          destinationChain: toChainId,
          status: 'PENDING',
        },
      });

      logger.info(
        {
          buyerAgentId,
          listingId,
          swapTxHash,
          usdcAmount,
        },
        'Purchase execution complete'
      );

      return {
        success: true,
        swapTxHash,
        transferExplorerUrl: transferResult.explorerUrl,
        usdcAmount,
      };
    } catch (error) {
      logger.error(
        {
          err: error,
          buyerAgentId,
          listingId,
        },
        'Purchase execution failed'
      );

      // Store failed transaction record
      const prisma = getPrismaClient();
      await prisma.proof.create({
        data: {
          type: 'AGENT_DECISION',
          hash: `failed-${Date.now()}`,
          agentId: buyerAgentId,
          data: {
            action: 'PURCHASE_FAILED',
            params,
            error: error instanceof Error ? error.message : 'Unknown error',
          } as any,
          signature: '',
          verified: false,
        },
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get purchase status
   *
   * @param txHash - Transaction hash (swap tx hash)
   * @returns Purchase status
   */
  async getPurchaseStatus(txHash: string): Promise<PurchaseStatus> {
    const prisma = getPrismaClient();

    const transaction = await prisma.transaction.findUnique({
      where: { hash: txHash },
      include: {
        fromAgent: true,
        toAgent: true,
        listing: true,
      },
    });

    if (!transaction) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    return {
      transaction,
      status: transaction.status as 'PENDING' | 'CONFIRMED' | 'FAILED',
    };
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up AgentService');
    await this.walletService.disconnect();
    await this.nexusService.cleanup();
    logger.info('AgentService cleanup complete');
  }
}

/**
 * Singleton instance
 */
let agentServiceInstance: AgentService | null = null;

/**
 * Get or create the Agent service instance
 */
export function getAgentService(): AgentService {
  if (!agentServiceInstance) {
    agentServiceInstance = new AgentService();
  }
  return agentServiceInstance;
}
