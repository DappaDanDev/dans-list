import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService, getEmbeddingService } from '../embedding.service';
import { embed } from 'ai';

// Mock the AI SDK
vi.mock('ai', () => ({
  embed: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  loggers: {
    ai: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    },
  },
  logUtils: {
    logPerformance: vi.fn(),
  },
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService();
    vi.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('generates 1536-dimensional embeddings', async () => {
      // Mock the embed function to return a valid embedding
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      vi.mocked(embed).mockResolvedValue({
        embedding: mockEmbedding,
        usage: { tokens: 10 },
      });

      const result = await service.generateEmbedding('test product');

      expect(result).toHaveLength(1536);
      expect(result).toEqual(mockEmbedding);
    });

    it('logs performance metrics', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      vi.mocked(embed).mockResolvedValue({
        embedding: mockEmbedding,
        usage: { tokens: 10 },
      });

      await service.generateEmbedding('test product');

      const { logUtils } = await import('@/lib/utils/logger');
      expect(logUtils.logPerformance).toHaveBeenCalledWith(
        'generateEmbedding',
        expect.any(Number),
        expect.objectContaining({
          tokens: 10,
          textLength: 12,
          model: 'text-embedding-3-large',
        })
      );
    });

    it('throws error on invalid embedding dimension', async () => {
      // Mock an invalid response (wrong dimension)
      vi.mocked(embed).mockResolvedValue({
        embedding: new Array(100).fill(0), // Wrong dimension
        usage: { tokens: 10 },
      });

      await expect(service.generateEmbedding('test')).rejects.toThrow();
    });

    it('throws error when API call fails', async () => {
      vi.mocked(embed).mockRejectedValue(new Error('API Error'));

      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'Failed to generate embedding: API Error'
      );
    });

    it('handles empty text input', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      vi.mocked(embed).mockResolvedValue({
        embedding: mockEmbedding,
        usage: { tokens: 0 },
      });

      const result = await service.generateEmbedding('');
      expect(result).toHaveLength(1536);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const vector = [1, 0, 0, 1];
      const similarity = service.cosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const similarity = service.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('returns -1.0 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      const similarity = service.cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('calculates similarity for similar vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 2.9];
      const similarity = service.cosineSimilarity(a, b);
      expect(similarity).toBeGreaterThan(0.99);
    });

    it('throws error for vectors of different lengths', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => service.cosineSimilarity(a, b)).toThrow('Vector length mismatch');
    });

    it('returns 0 for zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      const similarity = service.cosineSimilarity(a, b);
      expect(similarity).toBe(0);
    });
  });

  describe('getModel', () => {
    it('returns the model name', () => {
      expect(service.getModel()).toBe('text-embedding-3-large');
    });
  });

  describe('getDimensions', () => {
    it('returns 1536 dimensions', () => {
      expect(service.getDimensions()).toBe(1536);
    });
  });
});

describe('getEmbeddingService', () => {
  it('returns a singleton instance', () => {
    const instance1 = getEmbeddingService();
    const instance2 = getEmbeddingService();
    expect(instance1).toBe(instance2);
  });

  it('returns an EmbeddingService instance', () => {
    const instance = getEmbeddingService();
    expect(instance).toBeInstanceOf(EmbeddingService);
  });
});
