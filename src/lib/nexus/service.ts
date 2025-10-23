/**
 * NexusService - Avail Nexus cross-chain payment integration
 * Real SDK implementation with Vincent Ability Provider
 */

import { NexusSDK } from '@avail-project/nexus';
import type {
  TransferParams,
  TransferResult,
  OnIntentHookData,
  OnAllowanceHookData,
  NEXUS_EVENTS,
} from '@avail-project/nexus';
import { VincentProviderAbility } from '@/lib/vincent/provider-ability';
import { VincentWalletAbilityService } from '@/lib/vincent/wallet-ability.service';
import { loggers } from '@/lib/utils/logger';
import type { EIP1193Provider } from 'viem';

const logger = loggers.nexus;

/**
 * Transaction parameters for Nexus routing
 */
export interface NexusTransactionParams {
  fromAgentId: string;
  toAddress: string;
  amount: string; // Human-readable amount (e.g., "100" for 100 USDC)
  token: 'USDC' | 'USDT' | 'ETH'; // Nexus supported tokens
  destinationChainId: number;
}

/**
 * Transaction result from Nexus
 */
export interface NexusTransactionResult {
  transactionHash?: string;
  status: 'SUCCESS' | 'FAILED';
  explorerUrl?: string;
  error?: string;
}

/**
 * Nexus service configuration
 */
interface NexusConfig {
  network: 'mainnet' | 'testnet';
}

/**
 * NexusService handles cross-chain payments via Avail Nexus
 *
 * CRITICAL ARCHITECTURE:
 * - Uses Vincent PKP wallet via VincentProviderAbility
 * - Autonomous agent approval via hooks (no user prompts)
 * - Event-driven progress tracking
 * - Integrates with VincentWalletAbilityService for wallet addresses
 */
export class NexusService {
  private config: NexusConfig;
  private sdkCache = new Map<string, NexusSDK>();
  private walletService: VincentWalletAbilityService;

  constructor(config?: Partial<NexusConfig>) {
    this.config = {
      network: (process.env.NEXUS_NETWORK as 'mainnet' | 'testnet') || 'testnet',
      ...config,
    };

    this.walletService = new VincentWalletAbilityService();

    logger.info({
      network: this.config.network,
    }, 'NexusService initialized with real SDK');
  }

  /**
   * Get or create Nexus SDK instance for an agent
   * Initializes with Vincent provider and sets up hooks
   */
  private async getSDK(agentId: string): Promise<NexusSDK> {
    // Check cache first
    if (this.sdkCache.has(agentId)) {
      logger.debug({ agentId }, 'Using cached Nexus SDK');
      return this.sdkCache.get(agentId)!;
    }

    try {
      logger.info({ agentId }, 'Creating new Nexus SDK instance');

      // Step 1: Get PKP wallet address for agent
      const walletAddress = await this.walletService.getWalletAddress(agentId);

      logger.debug({ agentId, walletAddress }, 'Got wallet address from VincentAuth');

      // Step 2: Create Vincent provider for agent's PKP wallet
      // CRITICAL: This provider uses Vincent Ability SDK to sign transactions
      const provider = new VincentProviderAbility({
        walletAddress,
        chainId: 11155111, // Default to Ethereum Sepolia
      });

      logger.debug({ agentId }, 'Created VincentProviderAbility');

      // Step 3: Create Nexus SDK instance
      const nexusSdk = new NexusSDK({
        network: this.config.network,
        debug: process.env.NODE_ENV === 'development',
      });

      logger.debug({ agentId, network: this.config.network }, 'Created Nexus SDK instance');

      // Step 4: Initialize SDK with Vincent provider
      await nexusSdk.initialize(provider as unknown as EIP1193Provider);

      logger.info({ agentId }, 'Nexus SDK initialized with Vincent provider');

      // Step 5: Set up autonomous approval hooks
      this.setupHooks(nexusSdk, agentId);

      // Step 6: Set up event listeners
      this.setupEventListeners(nexusSdk, agentId);

      // Cache the SDK
      this.sdkCache.set(agentId, nexusSdk);

      logger.info({ agentId }, 'Nexus SDK ready and cached');

      return nexusSdk;
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to create Nexus SDK');
      throw new Error(`Failed to initialize Nexus SDK: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set up autonomous approval hooks for agent
   *
   * CRITICAL: Agents auto-approve all intents and allowances
   * This enables autonomous operation without user prompts
   */
  private setupHooks(sdk: NexusSDK, agentId: string): void {
    logger.debug({ agentId }, 'Setting up autonomous approval hooks');

    // Intent hook: Auto-approve all intents
    sdk.setOnIntentHook((data: OnIntentHookData) => {
      logger.info({
        agentId,
        intent: {
          id: (data.intent as any).id,
          status: (data.intent as any).status,
        },
      }, 'Auto-approving intent for autonomous agent');

      // CRITICAL: Automatically allow the intent
      // This enables autonomous agent operation
      data.allow();
    });

    // Allowance hook: Auto-approve minimum required allowances
    sdk.setOnAllowanceHook((data: OnAllowanceHookData) => {
      logger.info({
        agentId,
        sources: data.sources,
      }, 'Auto-approving token allowance for autonomous agent');

      // CRITICAL: Approve minimum required allowance
      // Using 'min' to only approve what's needed for this transaction
      data.allow(['min']);
    });

    logger.info({ agentId }, 'Autonomous approval hooks configured');
  }

  /**
   * Set up event listeners for progress tracking
   *
   * Listens to Nexus events for detailed operation tracking
   */
  private setupEventListeners(sdk: NexusSDK, agentId: string): void {
    logger.debug({ agentId }, 'Setting up Nexus event listeners');

    // Step complete event
    sdk.nexusEvents.on('step_complete', (data: any) => {
      logger.info({
        agentId,
        step: data,
      }, 'Nexus step completed');
    });

    // Expected steps event
    sdk.nexusEvents.on('expected_steps', (data: any) => {
      logger.info({
        agentId,
        steps: data,
      }, 'Nexus expected steps received');
    });

    // Bridge execute expected steps
    sdk.nexusEvents.on('bridge_execute_expected_steps', (data: any) => {
      logger.info({
        agentId,
        steps: data,
      }, 'Bridge execute expected steps');
    });

    // Bridge execute completed steps
    sdk.nexusEvents.on('bridge_execute_completed_steps', (data: any) => {
      logger.info({
        agentId,
        steps: data,
      }, 'Bridge execute completed steps');
    });

    logger.debug({ agentId }, 'Event listeners configured');
  }

  /**
   * Execute a cross-chain USDC transfer
   *
   * Uses Nexus SDK transfer() method for cross-chain transfers
   * Automatically handles chain abstraction and routing
   *
   * @param params - Transfer parameters
   * @returns Transfer result with status and explorer URL
   */
  async executeTransfer(
    params: NexusTransactionParams
  ): Promise<NexusTransactionResult> {
    logger.info({
      fromAgentId: params.fromAgentId,
      toAddress: params.toAddress,
      amount: params.amount,
      token: params.token,
      destChain: params.destinationChainId,
    }, 'Starting Nexus cross-chain transfer');

    try {
      // Step 1: Get Nexus SDK for agent
      const sdk = await this.getSDK(params.fromAgentId);

      logger.debug({ agentId: params.fromAgentId }, 'Got Nexus SDK instance');

      // Step 2: Prepare transfer parameters
      const transferParams: TransferParams = {
        token: params.token,
        amount: params.amount, // Human-readable amount
        chainId: params.destinationChainId,
        recipient: params.toAddress as `0x${string}`,
      };

      logger.info({
        agentId: params.fromAgentId,
        transferParams,
      }, 'Executing Nexus transfer');

      // Step 3: Execute transfer via Nexus SDK
      // This handles:
      // - Chain abstraction (auto-routing from any source chain)
      // - Token approvals (via allowance hook)
      // - Intent creation and approval (via intent hook)
      // - Cross-chain bridging if needed
      const result: TransferResult = await sdk.transfer(transferParams);

      logger.info({
        agentId: params.fromAgentId,
        result,
      }, 'Nexus transfer completed');

      // Step 4: Return standardized result
      return {
        status: result.success ? 'SUCCESS' : 'FAILED',
        explorerUrl: result.explorerUrl,
        error: result.error,
      };
    } catch (error) {
      logger.error({
        err: error,
        agentId: params.fromAgentId,
      }, 'Nexus transfer failed');

      return {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Simulate a transfer to estimate costs (optional)
   *
   * Uses simulateTransfer to get cost estimates before execution
   */
  async simulateTransfer(
    params: NexusTransactionParams
  ): Promise<{
    estimatedCost?: string;
    success: boolean;
    error?: string;
  }> {
    try {
      const sdk = await this.getSDK(params.fromAgentId);

      const transferParams: TransferParams = {
        token: params.token,
        amount: params.amount,
        chainId: params.destinationChainId,
        recipient: params.toAddress as `0x${string}`,
      };

      logger.debug({
        agentId: params.fromAgentId,
        transferParams,
      }, 'Simulating Nexus transfer');

      const simulation = await sdk.simulateTransfer(transferParams);

      logger.info({
        agentId: params.fromAgentId,
        simulation,
      }, 'Transfer simulation completed');

      return {
        success: true,
        // Add any cost estimation from simulation if available
      };
    } catch (error) {
      logger.error({
        err: error,
        agentId: params.fromAgentId,
      }, 'Transfer simulation failed');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clear SDK cache (useful for testing)
   */
  clearCache(): void {
    // Clean up SDK instances
    for (const [agentId, sdk] of this.sdkCache.entries()) {
      logger.debug({ agentId }, 'Deinitializing Nexus SDK');
      sdk.deinit().catch((error) => {
        logger.warn({ err: error, agentId }, 'Error during SDK deinit');
      });
    }

    this.sdkCache.clear();
    logger.info('Nexus SDK cache cleared');
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up NexusService');

    // Disconnect wallet service
    await this.walletService.disconnect();

    // Clear SDK cache
    this.clearCache();

    logger.info('NexusService cleanup complete');
  }
}

/**
 * Singleton instance
 */
let nexusServiceInstance: NexusService | null = null;

/**
 * Get or create the Nexus service instance
 */
export function getNexusService(config?: Partial<NexusConfig>): NexusService {
  if (!nexusServiceInstance) {
    nexusServiceInstance = new NexusService(config);
  }
  return nexusServiceInstance;
}
