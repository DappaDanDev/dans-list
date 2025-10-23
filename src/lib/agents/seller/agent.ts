import { getPrismaClient } from '@/lib/database/prisma.service';
import { MarketplaceSearchAgent } from '../marketplace/search.agent';
import { VincentWalletService } from '@/lib/vincent/wallet.service';
import { loggers } from '@/lib/utils/logger';
import type { Listing, PrismaClient } from '@/generated/prisma';
import type { AgentWalletPolicy } from '@/lib/vincent/types';
import { ethers } from 'ethers';

const logger = loggers.agent;

interface CreateListingInput {
  title: string;
  description: string;
  imageUrl: string;
  price: number;
  category: string;
  condition: string;
  features: Record<string, unknown>;
  searchTags: string[];
  aiProofHash?: string;
}

export class SellerAgent {
  constructor(
    private agentId: string,
    private vincentService: VincentWalletService,
    private searchAgent: MarketplaceSearchAgent,
    private prisma: PrismaClient = getPrismaClient(),
  ) {}

  /**
   * Factory method for easy instantiation with default dependencies
   */
  static create(agentId: string): SellerAgent {
    return new SellerAgent(
      agentId,
      new VincentWalletService(),
      new MarketplaceSearchAgent(),
      getPrismaClient(),
    );
  }

  async createListing(data: CreateListingInput): Promise<Listing> {
    logger.info({ agentId: this.agentId, title: data.title }, 'Creating listing');

    try {
      const listing = await this.prisma.listing.create({
        data: {
          title: data.title,
          description: data.description,
          imageUrl: data.imageUrl,
          price: data.price,
          category: data.category,
          condition: data.condition,
          features: data.features as any,
          searchTags: data.searchTags,
          aiProofHash: data.aiProofHash,
          sellerAgentId: this.agentId,
          status: 'AVAILABLE',
        },
      });

      // Index for semantic search
      await this.searchAgent.indexListing(listing.id);

      logger.info({ listingId: listing.id }, 'Listing created and indexed');

      return listing;
    } catch (error) {
      logger.error({ err: error }, 'Failed to create listing');
      throw error;
    }
  }

  async handleOffer(offerId: string, offerPrice: number, listingId: string): Promise<'ACCEPT' | 'REJECT' | 'COUNTER'> {
    logger.info({ agentId: this.agentId, offerId, listingId }, 'Evaluating offer');

    try {
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        throw new Error('Listing not found');
      }

      // listing.price is already a Decimal type from Prisma
      const listingPrice = typeof listing.price === 'number'
        ? listing.price
        : Number(listing.price);
      const threshold = listingPrice * 0.9; // Accept if >= 90%

      if (offerPrice >= threshold) {
        logger.info({ offerId, offerPrice }, 'Offer accepted');
        return 'ACCEPT';
      } else if (offerPrice >= listingPrice * 0.75) {
        logger.info({ offerId }, 'Counter-offering');
        return 'COUNTER';
      } else {
        logger.info({ offerId, threshold }, 'Offer rejected');
        return 'REJECT';
      }
    } catch (error) {
      logger.error({ err: error, offerId }, 'Failed to handle offer');
      throw error;
    }
  }

  async updatePrice(listingId: string, newPrice: number): Promise<void> {
    logger.info({ agentId: this.agentId, listingId, newPrice }, 'Updating listing price');

    try {
      await this.prisma.listing.update({
        where: { id: listingId, sellerAgentId: this.agentId },
        data: { price: newPrice },
      });

      logger.info({ listingId }, 'Price updated successfully');
    } catch (error) {
      logger.error({ err: error, listingId }, 'Failed to update price');
      throw error;
    }
  }

  /**
   * Set policy thresholds for the seller agent's Vincent wallet
   * Syncs policies to Vincent and updates database
   */
  async setPolicyThresholds(
    maxPrice: number,
    dailyLimit: number,
    approvedContracts?: string[]
  ): Promise<void> {
    logger.info({
      agentId: this.agentId,
      maxPrice,
      dailyLimit,
    }, 'Setting policy thresholds');

    try {
      // Build policy object
      const policy: AgentWalletPolicy = {
        maxTransactionValue: ethers.parseEther(maxPrice.toString()).toString(),
        dailySpendingLimit: ethers.parseEther(dailyLimit.toString()).toString(),
        approvedContractAddresses: approvedContracts || [],
        maxGasPrice: ethers.parseUnits('50', 'gwei').toString(),
        allowedTokens: ['PYUSD', 'ETH'],
      };

      // Sync to Vincent
      await this.vincentService.setPolicy(this.agentId, policy);

      // Persist to database
      await this.prisma.agent.update({
        where: { id: this.agentId },
        data: {
          policies: policy as any,
          spendingLimit: maxPrice,
          dailyLimit: dailyLimit,
        },
      });

      logger.info({ agentId: this.agentId }, 'Policy thresholds synced to Vincent and database');
    } catch (error) {
      logger.error({ err: error, agentId: this.agentId }, 'Failed to set policy thresholds');
      throw error;
    }
  }
}
