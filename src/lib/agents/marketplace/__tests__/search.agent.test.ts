import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceSearchAgent, getSearchAgent } from '../search.agent';
import { EmbeddingService } from '../embedding.service';
import type { SearchQuery } from '../types';

// Mock the Prisma client
const mockPrisma = {
  listing: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
};

vi.mock('@/lib/database/prisma.service', () => ({
  getPrismaClient: () => mockPrisma,
}));

// Mock the embedding service
vi.mock('../embedding.service', () => {
  const MockEmbeddingService = vi.fn().mockImplementation(() => ({
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.5)),
    getModel: vi.fn().mockReturnValue('text-embedding-3-large'),
    getDimensions: vi.fn().mockReturnValue(1536),
  }));

  return {
    EmbeddingService: MockEmbeddingService,
  };
});

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  loggers: {
    agent: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    },
  },
}));

describe('MarketplaceSearchAgent', () => {
  let agent: MarketplaceSearchAgent;
  let mockEmbeddingService: EmbeddingService;

  beforeEach(() => {
    mockEmbeddingService = new EmbeddingService();
    agent = new MarketplaceSearchAgent(mockEmbeddingService);
    vi.clearAllMocks();
  });

  describe('semanticSearch', () => {
    it('finds semantically similar listings', async () => {
      const mockResults = [
        {
          id: 'listing1',
          title: 'Nike Running Shoes',
          description: 'Great running shoes',
          price: '75.50',
          category: 'Footwear',
          features: { brand: 'Nike', size: '10' },
          similarity: '0.95',
        },
        {
          id: 'listing2',
          title: 'Adidas Sneakers',
          description: 'Comfortable sneakers',
          price: '65.00',
          category: 'Footwear',
          features: { brand: 'Adidas', size: '9' },
          similarity: '0.87',
        },
      ];

      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue(mockResults);

      const query: SearchQuery = {
        query: 'running shoes',
        maxResults: 10,
      };

      const results = await agent.semanticSearch(query);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        listingId: 'listing1',
        title: 'Nike Running Shoes',
        description: 'Great running shoes',
        price: 75.50,
        similarity: 0.95,
        metadata: {
          category: 'Footwear',
          features: { brand: 'Nike', size: '10' },
        },
      });
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('running shoes');
    });

    it('applies price range filter', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([]);

      const query: SearchQuery = {
        query: 'shoes',
        priceRange: { min: 50, max: 100 },
      };

      await agent.semanticSearch(query);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      const call = vi.mocked(mockPrisma.$queryRaw).mock.calls[0];
      expect(call).toBeDefined();
    });

    it('applies category filter', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([]);

      const query: SearchQuery = {
        query: 'shoes',
        category: 'Footwear',
      };

      await agent.semanticSearch(query);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('respects maxResults limit', async () => {
      const mockResults = Array.from({ length: 5 }, (_, i) => ({
        id: `listing${i}`,
        title: `Product ${i}`,
        description: `Description ${i}`,
        price: '50.00',
        category: 'Test',
        features: {},
        similarity: '0.9',
      }));

      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue(mockResults);

      const results = await agent.semanticSearch({
        query: 'test',
        maxResults: 5,
      });

      expect(results).toHaveLength(5);
    });

    it('throws error when search fails', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockRejectedValue(new Error('Database error'));

      await expect(agent.semanticSearch({ query: 'test' })).rejects.toThrow();
    });

    it('returns empty array when no results found', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([]);

      const results = await agent.semanticSearch({ query: 'nonexistent product' });

      expect(results).toEqual([]);
    });
  });

  describe('indexListing', () => {
    it('generates and stores embedding for a listing', async () => {
      const mockListing = {
        title: 'Test Product',
        description: 'Test Description',
        category: 'Electronics',
        features: { brand: 'TestBrand' },
        condition: 'New',
      };

      vi.mocked(mockPrisma.listing.findUnique).mockResolvedValue(mockListing as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      await agent.indexListing('listing123');

      expect(mockPrisma.listing.findUnique).toHaveBeenCalledWith({
        where: { id: 'listing123' },
        select: {
          title: true,
          description: true,
          category: true,
          features: true,
          condition: true,
        },
      });

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('Test Product')
      );

      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('throws error when listing not found', async () => {
      vi.mocked(mockPrisma.listing.findUnique).mockResolvedValue(null);

      await expect(agent.indexListing('nonexistent')).rejects.toThrow(
        'Listing nonexistent not found'
      );
    });

    it('throws error when embedding generation fails', async () => {
      const mockListing = {
        title: 'Test',
        description: 'Test',
        category: 'Test',
        features: {},
        condition: 'New',
      };

      vi.mocked(mockPrisma.listing.findUnique).mockResolvedValue(mockListing as any);
      vi.mocked(mockEmbeddingService.generateEmbedding).mockRejectedValue(
        new Error('API Error')
      );

      await expect(agent.indexListing('listing123')).rejects.toThrow();
    });
  });

  describe('batchIndexListings', () => {
    it('indexes multiple listings successfully', async () => {
      const mockListing = {
        title: 'Test',
        description: 'Test',
        category: 'Test',
        features: {},
        condition: 'New',
      };

      vi.mocked(mockPrisma.listing.findUnique).mockResolvedValue(mockListing as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const successCount = await agent.batchIndexListings(['listing1', 'listing2', 'listing3']);

      expect(successCount).toBe(3);
      expect(mockPrisma.listing.findUnique).toHaveBeenCalledTimes(3);
    });

    it('continues on partial failures', async () => {
      const mockListing = {
        title: 'Test',
        description: 'Test',
        category: 'Test',
        features: {},
        condition: 'New',
      };

      vi.mocked(mockPrisma.listing.findUnique)
        .mockResolvedValueOnce(mockListing as any)
        .mockRejectedValueOnce(new Error('DB Error'))
        .mockResolvedValueOnce(mockListing as any);

      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const successCount = await agent.batchIndexListings(['listing1', 'listing2', 'listing3']);

      expect(successCount).toBe(2); // Only 2 succeeded
    });
  });

  describe('reindexAll', () => {
    it('reindexes all available listings', async () => {
      const mockListings = [
        { id: 'listing1' },
        { id: 'listing2' },
        { id: 'listing3' },
      ];

      vi.mocked(mockPrisma.listing.findMany).mockResolvedValue(mockListings as any);

      const mockListing = {
        title: 'Test',
        description: 'Test',
        category: 'Test',
        features: {},
        condition: 'New',
      };

      vi.mocked(mockPrisma.listing.findUnique).mockResolvedValue(mockListing as any);
      vi.mocked(mockPrisma.$executeRaw).mockResolvedValue(1);

      const successCount = await agent.reindexAll();

      expect(successCount).toBe(3);
      expect(mockPrisma.listing.findMany).toHaveBeenCalledWith({
        where: { status: 'AVAILABLE' },
        select: { id: true },
      });
    });

    it('throws error when database query fails', async () => {
      vi.mocked(mockPrisma.listing.findMany).mockRejectedValue(new Error('DB Error'));

      await expect(agent.reindexAll()).rejects.toThrow('DB Error');
    });
  });
});

describe('getSearchAgent', () => {
  it('returns a singleton instance', () => {
    const instance1 = getSearchAgent();
    const instance2 = getSearchAgent();
    expect(instance1).toBe(instance2);
  });

  it('returns a MarketplaceSearchAgent instance', () => {
    const instance = getSearchAgent();
    expect(instance).toBeInstanceOf(MarketplaceSearchAgent);
  });
});
