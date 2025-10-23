/**
 * Vincent Wallet Service
 * Manages Lit Protocol PKP wallets with session caching and retry logic
 */

import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';
import type {
  VincentWallet,
  AgentWalletPolicy,
  SignTypedDataRequest,
  LitSession,
  CreateWalletResponse,
  SignatureResponse,
  VincentConfig,
} from './types';
import {
  DEFAULT_POLICY,
  SESSION_EXPIRATION_MS,
  MAX_RETRY_ATTEMPTS,
  INITIAL_RETRY_DELAY_MS,
} from './types';

const logger = loggers.vincent;

/**
 * Vincent Wallet Service
 * Implements shared LitNodeClient with session management and retry logic
 */
export class VincentWalletService {
  private static litClient: LitNodeClient | null = null;
  private static session: LitSession | null = null;
  private static initializationPromise: Promise<LitNodeClient> | null = null;

  private config: VincentConfig;

  constructor(config?: Partial<VincentConfig>) {
    this.config = {
      network: process.env.VINCENT_LIT_NETWORK || 'datil-test',
      debug: process.env.NODE_ENV === 'development',
      sessionTimeout: SESSION_EXPIRATION_MS,
      ...config,
    };

    logger.info({ network: this.config.network }, 'VincentWalletService initialized');
  }

  /**
   * Ensure LitNodeClient is connected with retry and backoff
   * Uses shared client instance to avoid multiple connections
   */
  private async ensureLitConnection(): Promise<LitNodeClient> {
    // Return existing client if already connected
    if (VincentWalletService.litClient?.ready) {
      logger.debug('Using existing Lit client connection');
      return VincentWalletService.litClient;
    }

    // Wait for ongoing initialization
    if (VincentWalletService.initializationPromise) {
      logger.debug('Waiting for ongoing Lit client initialization');
      return VincentWalletService.initializationPromise;
    }

    // Start new initialization
    VincentWalletService.initializationPromise = this.connectWithRetry();

    try {
      const client = await VincentWalletService.initializationPromise;
      VincentWalletService.litClient = client;
      return client;
    } finally {
      VincentWalletService.initializationPromise = null;
    }
  }

  /**
   * Connect to Lit Network with exponential backoff retry logic
   */
  private async connectWithRetry(
    attempt: number = 1
  ): Promise<LitNodeClient> {
    try {
      logger.info({ attempt, network: this.config.network }, 'Connecting to Lit Network');

      const litNodeClient = new LitNodeClient({
        litNetwork: this.config.network as any,
        debug: this.config.debug,
      });

      await litNodeClient.connect();

      logger.info('Successfully connected to Lit Network');
      return litNodeClient;
    } catch (error) {
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        logger.error(
          { err: error, attempt },
          'Failed to connect to Lit Network after max retries'
        );
        throw new Error(`Lit Network connection failed after ${MAX_RETRY_ATTEMPTS} attempts`);
      }

      // Exponential backoff: 1s, 2s, 4s, etc.
      const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn(
        { attempt, delayMs, maxAttempts: MAX_RETRY_ATTEMPTS },
        'Retrying Lit Network connection'
      );

      await new Promise(resolve => setTimeout(resolve, delayMs));
      return this.connectWithRetry(attempt + 1);
    }
  }

  /**
   * Get or refresh session with cached auth signature
   * Sessions are reused to avoid re-authentication
   */
  private async getSession(): Promise<LitSession> {
    const now = Date.now();

    // Return cached session if still valid
    if (
      VincentWalletService.session &&
      VincentWalletService.session.expiration > now
    ) {
      logger.debug({ expiresIn: VincentWalletService.session.expiration - now }, 'Using cached session');
      return VincentWalletService.session;
    }

    logger.info('Creating new Lit session');

    try {
      const litClient = await this.ensureLitConnection();

      // Generate session signatures
      // NOTE: This is a placeholder - actual implementation depends on
      // how you want to handle session auth (e.g., wallet signature, etc.)
      const authSig = await this.generateAuthSignature();

      VincentWalletService.session = {
        authSig,
        expiration: now + this.config.sessionTimeout!,
      };

      logger.info({ expiresIn: this.config.sessionTimeout }, 'New session created');
      return VincentWalletService.session;
    } catch (error) {
      logger.error({ err: error }, 'Failed to create session');
      throw error;
    }
  }

  /**
   * Generate authentication signature for session
   * NOTE: Placeholder implementation - customize based on your auth strategy
   */
  private async generateAuthSignature(): Promise<any> {
    // In production, this would:
    // 1. Prompt user wallet signature
    // 2. Or use a service wallet
    // 3. Or use capacity credits
    //
    // For now, returning a mock signature for structure
    logger.debug('Generating auth signature (placeholder)');

    return {
      sig: '0x' + 'mock'.repeat(32),
      derivedVia: 'web3.eth.personal.sign',
      signedMessage: 'Vincent Wallet Auth',
      address: '0x' + 'placeholder'.repeat(5).slice(0, 40),
    };
  }

  /**
   * Ensure agent has a Vincent wallet, creating one if it doesn't exist
   * Persists default policy JSON to satisfy Agent.policies non-null constraint
   */
  async ensureWallet(agentId: string): Promise<VincentWallet> {
    logger.info({ agentId }, 'Ensuring wallet exists for agent');

    const prisma = getPrismaClient();

    // Check if agent already has a wallet
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Return existing wallet if PKP ID is set
    if (agent.vincentPkpId) {
      logger.debug({ agentId, pkpId: agent.vincentPkpId }, 'Agent already has wallet');

      return {
        pkpId: agent.vincentPkpId,
        address: agent.walletAddress,
        policies: agent.policies as AgentWalletPolicy,
      };
    }

    // Create new PKP wallet
    logger.info({ agentId }, 'Creating new PKP wallet for agent');

    try {
      const litClient = await this.ensureLitConnection();
      const session = await this.getSession();

      // NOTE: Placeholder PKP creation - actual implementation would use:
      // const pkp = await litClient.createPKP({ authSig: session.authSig });
      //
      // For structure purposes, creating mock PKP data
      const mockPkpId = `pkp_${agentId}_${Date.now()}`;
      const mockAddress = '0x' + agentId.slice(0, 40).padEnd(40, '0');
      const mockPublicKey = '0x04' + mockPkpId.padEnd(128, '0');

      logger.info({
        agentId,
        pkpId: mockPkpId,
        address: mockAddress,
      }, 'PKP wallet created (mock)');

      // Update agent with wallet info and default policy
      const updatedAgent = await prisma.agent.update({
        where: { id: agentId },
        data: {
          vincentPkpId: mockPkpId,
          walletAddress: mockAddress,
          policies: DEFAULT_POLICY as any, // Satisfies non-null constraint
        },
      });

      logger.info({ agentId, pkpId: mockPkpId }, 'Agent updated with wallet');

      return {
        pkpId: mockPkpId,
        address: mockAddress,
        policies: DEFAULT_POLICY,
        publicKey: mockPublicKey,
      };
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to create wallet');
      throw new Error(`Failed to create wallet for agent ${agentId}: ${error}`);
    }
  }

  /**
   * Sign EIP-712 typed data using agent's PKP wallet
   * Uses cached session to avoid re-authentication
   */
  async signTypedData(request: SignTypedDataRequest): Promise<string> {
    logger.info({ agentId: request.agentId }, 'Signing typed data');

    try {
      // Ensure wallet exists
      const wallet = await this.ensureWallet(request.agentId);

      // Get session
      const session = await this.getSession();
      const litClient = await this.ensureLitConnection();

      // NOTE: Placeholder signing - actual implementation would use:
      // const signature = await litClient.pkpSign({
      //   pkpPublicKey: wallet.publicKey,
      //   toSign: typedDataHash,
      //   authSig: session.authSig,
      // });
      //
      // For structure, generating mock signature
      const typedDataHash = JSON.stringify(request.value);
      const mockSignature = '0x' + Buffer.from(typedDataHash).toString('hex').slice(0, 130);

      logger.info({
        agentId: request.agentId,
        signatureLength: mockSignature.length,
      }, 'Typed data signed (mock)');

      // Store proof in database
      const prisma = getPrismaClient();
      await prisma.proof.create({
        data: {
          type: 'AGENT_DECISION',
          hash: mockSignature,
          agentId: request.agentId,
          data: {
            domain: request.domain,
            types: request.types,
            value: request.value,
            pkpId: wallet.pkpId,
          } as any,
          signature: mockSignature,
          verified: false,
        },
      });

      return mockSignature;
    } catch (error) {
      logger.error({ err: error, agentId: request.agentId }, 'Failed to sign typed data');
      throw error;
    }
  }

  /**
   * Update agent's wallet policies and sync to Lit
   */
  async setPolicy(agentId: string, policy: AgentWalletPolicy): Promise<void> {
    logger.info({ agentId }, 'Updating wallet policy');

    try {
      const wallet = await this.ensureWallet(agentId);

      // NOTE: Actual implementation would sync policy to Lit Protocol
      // For now, just updating database
      const prisma = getPrismaClient();
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          policies: policy as any,
        },
      });

      logger.info({ agentId, policy }, 'Policy updated');
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to update policy');
      throw error;
    }
  }

  /**
   * Verify that a signature was created by the agent's PKP
   */
  async verifyWalletOwnership(
    agentId: string,
    signature: string,
    message: string
  ): Promise<boolean> {
    logger.debug({ agentId }, 'Verifying wallet ownership');

    try {
      const wallet = await this.ensureWallet(agentId);

      // NOTE: Actual implementation would verify signature against PKP public key
      // For now, just checking signature format
      const isValid = signature.startsWith('0x') && signature.length >= 132;

      logger.info({ agentId, isValid }, 'Wallet ownership verification complete');
      return isValid;
    } catch (error) {
      logger.error({ err: error, agentId }, 'Failed to verify wallet ownership');
      return false;
    }
  }

  /**
   * Disconnect from Lit Network (cleanup)
   */
  static async disconnect(): Promise<void> {
    if (VincentWalletService.litClient) {
      logger.info('Disconnecting from Lit Network');
      await VincentWalletService.litClient.disconnect();
      VincentWalletService.litClient = null;
      VincentWalletService.session = null;
    }
  }
}
