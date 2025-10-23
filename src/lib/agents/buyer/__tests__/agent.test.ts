import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuyerAgent } from '../agent';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { A2AClient } from '../../a2a/client';

vi.mock('@/lib/utils/logger', () => ({
  loggers: {
    agent: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

vi.mock('@/lib/database/prisma.service', () => ({
  getPrismaClient: vi.fn(),
}));

vi.mock('../../a2a/client', () => ({
  A2AClient: vi.fn(),
}));

describe('BuyerAgent', () => {
  let buyerAgent: BuyerAgent;
  let mockPrisma: any;
  let mockA2AClient: any;

  beforeEach(() => {
    mockPrisma = {
      listing: {
        findUnique: vi.fn(),
      },
      agent: {
        findUnique: vi.fn(),
      },
      message: {
        create: vi.fn(),
      },
      transaction: {
        create: vi.fn(),
      },
    };

    mockA2AClient = {
      call: vi.fn(),
    };

    (getPrismaClient as any).mockReturnValue(mockPrisma);
    (A2AClient as any).mockImplementation(() => mockA2AClient);

    buyerAgent = new BuyerAgent('test-buyer-agent-1');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('searchListings', () => {
    it('should search listings via A2A protocol', async () => {
      const mockResults = [
        {
          listingId: 'listing-1',
          title: 'iPhone 14',
          description: 'Excellent condition',
          price: 500,
          similarity: 0.95,
        },
      ];

      mockA2AClient.call.mockResolvedValue(mockResults);

      const results = await buyerAgent.searchListings('iPhone');

      expect(mockA2AClient.call).toHaveBeenCalledWith('marketplace.search', {
        query: 'iPhone',
        maxResults: 10,
      });
      expect(results).toEqual(mockResults);
    });

    it('should handle A2A search errors', async () => {
      mockA2AClient.call.mockRejectedValue(new Error('Network error'));

      await expect(buyerAgent.searchListings('iPhone')).rejects.toThrow('Network error');
    });
  });

  describe('makeOffer', () => {
    it('should create offer message in database', async () => {
      const mockMessage = {
        id: 'msg-1',
        jsonrpcId: expect.any(String),
        method: 'marketplace.offer',
        params: {
          listingId: 'listing-1',
          offerPrice: 450,
          agentId: 'test-buyer-agent-1',
        },
        fromAgentId: 'test-buyer-agent-1',
        createdAt: new Date(),
      };

      mockPrisma.message.create.mockResolvedValue(mockMessage);

      const offerId = await buyerAgent.makeOffer('listing-1', 450);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          jsonrpcId: expect.any(String),
          method: 'marketplace.offer',
          params: {
            listingId: 'listing-1',
            offerPrice: 450,
            agentId: 'test-buyer-agent-1',
          },
          fromAgentId: 'test-buyer-agent-1',
        },
      });
      expect(typeof offerId).toBe('string');
    });

    it('should handle offer creation errors', async () => {
      mockPrisma.message.create.mockRejectedValue(new Error('Database error'));

      await expect(buyerAgent.makeOffer('listing-1', 450)).rejects.toThrow('Database error');
    });
  });

  describe('executePurchase', () => {
    it('should throw error when listing not found', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue(null);

      await expect(buyerAgent.executePurchase('nonexistent-listing')).rejects.toThrow(
        'Listing nonexistent-listing not found'
      );
    });

    it('should throw error when listing is not available', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        status: 'SOLD',
        price: 500,
        sellerAgentId: 'seller-1',
        sellerAgent: { walletAddress: '0xSeller' },
      });

      await expect(buyerAgent.executePurchase('listing-1')).rejects.toThrow(
        'Listing listing-1 is not available'
      );
    });

    it('should create pending transaction for available listing', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        status: 'AVAILABLE',
        price: 500,
        sellerAgentId: 'seller-1',
        sellerAgent: { walletAddress: '0xSeller' },
      });

      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-1',
        hash: '0xpending_12345',
        fromAgentId: 'test-buyer-agent-1',
        toAgentId: 'seller-1',
        listingId: 'listing-1',
        amount: 500,
        token: 'PYUSD',
        sourceChain: 84532,
        destinationChain: 84532,
        status: 'PENDING',
      });

      const txHash = await buyerAgent.executePurchase('listing-1');

      expect(txHash).toContain('0xpending_');
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: {
          hash: expect.stringContaining('0xpending_'),
          fromAgentId: 'test-buyer-agent-1',
          toAgentId: 'seller-1',
          listingId: 'listing-1',
          amount: 500,
          token: 'PYUSD',
          sourceChain: 84532,
          destinationChain: 84532,
          status: 'PENDING',
        },
      });
    });

    it('should handle database errors during purchase', async () => {
      mockPrisma.listing.findUnique.mockRejectedValue(new Error('Database connection lost'));

      await expect(buyerAgent.executePurchase('listing-1')).rejects.toThrow(
        'Database connection lost'
      );
    });
  });
});
