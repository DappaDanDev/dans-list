import { getPrismaClient } from '@/lib/database/prisma.service';
import { A2AClient } from '../a2a/client';
import { VincentWalletService } from '@/lib/vincent/wallet.service';
import { NexusService, getNexusService } from '@/lib/nexus/service';
import { loggers } from '@/lib/utils/logger';
import type { SearchResult } from '../marketplace/types';
import type { PrismaClient } from '@/generated/prisma';
import { randomUUID } from 'crypto';

const logger = loggers.agent;

/**
 * Buyer Agent - Handles purchasing activities
 * Refactored for dependency injection to enable testing with Vincent & Nexus
 */
export class BuyerAgent {
  constructor(
    private agentId: string,
    private vincentService: VincentWalletService,
    private a2aClient: A2AClient,
    private nexusService: NexusService,
    private prisma: PrismaClient = getPrismaClient(),
  ) {}

  /**
   * Factory method for easy instantiation with default dependencies
   */
  static create(agentId: string): BuyerAgent {
    return new BuyerAgent(
      agentId,
      new VincentWalletService(),
      new A2AClient(),
      getNexusService(),
      getPrismaClient(),
    );
  }

  async searchListings(query: string): Promise<SearchResult[]> {
    logger.info({ agentId: this.agentId, query }, 'Buyer agent searching listings');

    try {
      const results = await this.a2aClient.call('marketplace.search', {
        query,
        maxResults: 10,
      });

      logger.info({
        agentId: this.agentId,
        resultsCount: Array.isArray(results) ? results.length : 0
      }, 'Search completed');

      return results as SearchResult[];
    } catch (error) {
      logger.error({ err: error, agentId: this.agentId, query }, 'Search failed');
      throw error;
    }
  }

  async makeOffer(listingId: string, offerPrice: number): Promise<string> {
    logger.info({ agentId: this.agentId, listingId, offerPrice }, 'Making offer');

    try {
      const offerId = randomUUID();

      const message = await this.prisma.message.create({
        data: {
          jsonrpcId: offerId,
          method: 'marketplace.offer',
          params: { listingId, offerPrice, agentId: this.agentId },
          fromAgentId: this.agentId,
        },
      });

      logger.info({ messageId: message.id, offerId }, 'Offer created');
      return offerId;
    } catch (error) {
      logger.error({ err: error, listingId }, 'Failed to make offer');
      throw error;
    }
  }

  async executePurchase(listingId: string): Promise<string> {
    logger.info({ agentId: this.agentId, listingId }, 'Executing purchase');

    // Phase 1: Database operations in Prisma transaction
    const transactionRecord = await this.prisma.$transaction(async (tx) => {
      // 1. Ensure wallet exists
      const wallet = await this.vincentService.ensureWallet(this.agentId);
      logger.debug({ pkpId: wallet.pkpId }, 'Wallet ensured');

      // 2. Get listing
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        include: { sellerAgent: true },
      });

      if (!listing) {
        throw new Error(`Listing ${listingId} not found`);
      }

      if (listing.status !== 'AVAILABLE') {
        throw new Error(`Listing ${listingId} is not available`);
      }

      // Get seller wallet address for Nexus routing
      const sellerWallet = await this.vincentService.ensureWallet(listing.sellerAgentId);

      // 3. Enforce policy limits
      const agent = await tx.agent.findUnique({
        where: { id: this.agentId },
      });

      if (!agent) {
        throw new Error(`Agent ${this.agentId} not found`);
      }

      const policy = agent.policies as any;
      const price = Number(listing.price);
      const maxTxValue = Number(policy.maxTransactionValue);

      if (price > maxTxValue) {
        throw new Error(
          `Purchase price ${price} exceeds transaction limit ${maxTxValue}`
        );
      }

      logger.debug({ price, maxTxValue }, 'Policy limits verified');

      // 4. Check for duplicate pending transactions
      const existingPending = await tx.transaction.findFirst({
        where: {
          listingId,
          fromAgentId: this.agentId,
          status: 'PENDING',
        },
      });

      if (existingPending) {
        throw new Error('Purchase already in progress for this listing');
      }

      // 5. Generate proof signature
      const proof = await this.vincentService.signTypedData({
        agentId: this.agentId,
        domain: {
          name: 'DansListMarketplace',
          version: '1',
          chainId: 84532,
        },
        types: {
          Purchase: [
            { name: 'listingId', type: 'string' },
            { name: 'buyer', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
          ],
        },
        value: {
          listingId,
          buyer: wallet.address,
          amount: listing.price.toString(),
          timestamp: Date.now(),
        },
      });

      logger.info({ proofHash: proof.slice(0, 20) }, 'Purchase proof generated');

      // 6. Create transaction record with placeholder hash
      const transaction = await tx.transaction.create({
        data: {
          hash: `0xpending_${Date.now()}`,
          fromAgentId: this.agentId,
          toAgentId: listing.sellerAgentId,
          listingId: listing.id,
          amount: listing.price,
          token: 'PYUSD',
          sourceChain: 84532, // Base Sepolia
          destinationChain: 84532,
          status: 'PENDING',
        },
      });

      // 7. Link proof to transaction
      await tx.proof.updateMany({
        where: {
          hash: proof,
          transactionId: null,
        },
        data: {
          transactionId: transaction.id,
        },
      });

      logger.info({
        transactionId: transaction.id,
        hash: transaction.hash,
        proofHash: proof,
      }, 'Transaction record created with Vincent proof');

      return {
        transaction,
        listing,
        wallet,
        sellerWallet,
      };
    });

    // Phase 2: Execute Nexus cross-chain transaction (outside Prisma transaction)
    try {
      logger.info({
        transactionId: transactionRecord.transaction.id,
        fromAgent: this.agentId,
        toAgent: transactionRecord.listing.sellerAgentId
      }, 'Executing Nexus cross-chain payment');

      const nexusResult = await this.nexusService.executeTransaction({
        fromAgentId: this.agentId,
        toAddress: transactionRecord.sellerWallet.address,
        amount: transactionRecord.listing.price.toString(),
        token: 'PYUSD',
        sourceChainId: 84532, // Base Sepolia
        destinationChainId: 84532, // Base Sepolia (same chain for now)
      });

      // Update transaction record with real Nexus hash
      await this.prisma.transaction.update({
        where: { id: transactionRecord.transaction.id },
        data: {
          hash: nexusResult.transactionHash,
          status: nexusResult.status,
        },
      });

      logger.info({
        transactionId: transactionRecord.transaction.id,
        nexusHash: nexusResult.transactionHash,
        nexusId: nexusResult.nexusId,
      }, 'Nexus payment executed successfully');

      return nexusResult.transactionHash;
    } catch (error) {
      // Update transaction status to FAILED
      await this.prisma.transaction.update({
        where: { id: transactionRecord.transaction.id },
        data: {
          status: 'FAILED',
        },
      });

      logger.error({
        err: error,
        transactionId: transactionRecord.transaction.id,
        listingId,
      }, 'Nexus payment failed');

      throw new Error(`Nexus payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
