import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { loggers, logUtils } from '@/lib/utils/logger';
import { z } from 'zod';

const logger = loggers.ai;

const EmbeddingResultSchema = z.object({
  embedding: z.array(z.number()).length(1536),
  usage: z.object({
    tokens: z.number(),
  }),
});

/**
 * Embedding service for generating vector embeddings using OpenAI
 * Uses text-embedding-3-large model for high-quality semantic search
 */
export class EmbeddingService {
  private readonly model = 'text-embedding-3-large';
  private readonly dimensions = 1536;

  /**
   * Generate a 1536-dimensional embedding for the given text
   * @param text - Text to generate embedding for
   * @returns Array of 1536 numbers representing the embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();

    logger.info({ textLength: text.length, model: this.model }, 'Generating embedding');

    try {
      const { embedding, usage } = await embed({
        model: openai.embedding(this.model),
        value: text,
      });

      // Validate response structure
      const result = EmbeddingResultSchema.parse({ embedding, usage });

      const duration = Date.now() - startTime;
      logUtils.logPerformance('generateEmbedding', duration, {
        tokens: result.usage.tokens,
        textLength: text.length,
        model: this.model,
      });

      logger.debug({
        dimensions: result.embedding.length,
        tokens: result.usage.tokens,
        duration
      }, 'Embedding generated successfully');

      return result.embedding;
    } catch (error) {
      logger.error({
        err: error,
        textLength: text.length,
        model: this.model
      }, 'Embedding generation failed');

      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param a - First vector
   * @param b - Second vector
   * @returns Similarity score between -1 and 1 (higher is more similar)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Get the model name used for embeddings
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get the embedding dimension size
   */
  getDimensions(): number {
    return this.dimensions;
  }
}

// Singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * Get or create the embedding service instance
 */
export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}
