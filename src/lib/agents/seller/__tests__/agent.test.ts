import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SellerAgent } from '../agent';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { MarketplaceSearchAgent } from '../../marketplace/search.agent';

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

vi.mock('../../marketplace/search.agent', () => ({
  MarketplaceSearchAgent: vi.fn(),
}));

describe('SellerAgent', () => {
  let sellerAgent: SellerAgent;
  let mockPrisma: any;
  let mockSearchAgent: any;

  beforeEach(() => {
    mockPrisma = {
      listing: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    mockSearchAgent = {
      indexListing: vi.fn(),
    };

    (getPrismaClient as any).mockReturnValue(mockPrisma);
    (MarketplaceSearchAgent as any).mockImplementation(() => mockSearchAgent);

    sellerAgent = new SellerAgent('test-seller-agent-1');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createListing', () => {
    it('should create listing and index for search', async () => {
      const listingInput = {
        title: 'iPhone 14 Pro',
        description: 'Mint condition, unlocked',
        imageUrl: 'https://example.com/iphone.jpg',
        price: 800,
        category: 'Electronics',
        condition: 'NEW',
        features: { storage: '256GB', color: 'Space Gray' },
        searchTags: ['phone', 'apple', 'iphone'],
        aiProofHash: '0xabcd1234',
      };

      const mockListing = {
        id: 'listing-1',
        ...listingInput,
        sellerAgentId: 'test-seller-agent-1',
        status: 'AVAILABLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.listing.create.mockResolvedValue(mockListing);
      mockSearchAgent.indexListing.mockResolvedValue(undefined);

      const listing = await sellerAgent.createListing(listingInput);

      expect(mockPrisma.listing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'iPhone 14 Pro',
          description: 'Mint condition, unlocked',
          price: 800,
          sellerAgentId: 'test-seller-agent-1',
          status: 'AVAILABLE',
        }),
      });

      expect(mockSearchAgent.indexListing).toHaveBeenCalledWith('listing-1');
      expect(listing.id).toBe('listing-1');
    });

    it('should handle listing creation errors', async () => {
      const listingInput = {
        title: 'Test Item',
        description: 'Test',
        imageUrl: 'https://example.com/test.jpg',
        price: 100,
        category: 'Test',
        condition: 'NEW',
        features: {},
        searchTags: [],
      };

      mockPrisma.listing.create.mockRejectedValue(new Error('Database error'));

      await expect(sellerAgent.createListing(listingInput)).rejects.toThrow('Database error');
    });
  });

  describe('handleOffer', () => {
    it('should accept offer >= 90% of asking price', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        price: 1000,
      });

      const decision = await sellerAgent.handleOffer('offer-1', 950, 'listing-1');

      expect(decision).toBe('ACCEPT');
    });

    it('should counter offer between 75% and 90%', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        price: 1000,
      });

      const decision = await sellerAgent.handleOffer('offer-1', 800, 'listing-1');

      expect(decision).toBe('COUNTER');
    });

    it('should reject offer < 75% of asking price', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        price: 1000,
      });

      const decision = await sellerAgent.handleOffer('offer-1', 700, 'listing-1');

      expect(decision).toBe('REJECT');
    });

    it('should throw error when listing not found', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue(null);

      await expect(sellerAgent.handleOffer('offer-1', 900, 'listing-1')).rejects.toThrow(
        'Listing not found'
      );
    });

    it('should accept exact threshold price (90%)', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        price: 1000,
      });

      const decision = await sellerAgent.handleOffer('offer-1', 900, 'listing-1');

      expect(decision).toBe('ACCEPT');
    });

    it('should counter exact threshold price (75%)', async () => {
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        price: 1000,
      });

      const decision = await sellerAgent.handleOffer('offer-1', 750, 'listing-1');

      expect(decision).toBe('COUNTER');
    });
  });

  describe('updatePrice', () => {
    it('should update listing price', async () => {
      mockPrisma.listing.update.mockResolvedValue({
        id: 'listing-1',
        price: 850,
      });

      await sellerAgent.updatePrice('listing-1', 850);

      expect(mockPrisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1', sellerAgentId: 'test-seller-agent-1' },
        data: { price: 850 },
      });
    });

    it('should handle price update errors', async () => {
      mockPrisma.listing.update.mockRejectedValue(new Error('Listing not owned by agent'));

      await expect(sellerAgent.updatePrice('listing-1', 850)).rejects.toThrow(
        'Listing not owned by agent'
      );
    });
  });
});
