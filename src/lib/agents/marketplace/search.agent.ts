import { getPrismaClient } from '@/lib/database/prisma.service';
import { EmbeddingService } from './embedding.service';
import { loggers } from '@/lib/utils/logger';
import { Prisma } from '@/generated/prisma';
import type { SearchQuery, SearchResult } from './types';

const logger = loggers.agent;

/**
 * Marketplace Search Agent with semantic vector search capabilities
 * Uses pgvector and OpenAI embeddings for intelligent product search
 */
export class MarketplaceSearchAgent {
  constructor(
    private embeddings: EmbeddingService = new EmbeddingService(),
  ) {}

  /**
   * Perform semantic search on marketplace listings
   * @param query - Search query with optional filters
   * @returns Array of search results sorted by similarity
   */
  async semanticSearch(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();
    logger.info({ query }, 'Performing semantic search');

    const prisma = getPrismaClient();

    try {
      // 1. Generate query embedding
      const queryEmbedding = await this.embeddings.generateEmbedding(query.query);
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      // 2. Build price filter if provided
      const priceCondition = query.priceRange
        ? Prisma.sql`AND price BETWEEN ${query.priceRange.min} AND ${query.priceRange.max}`
        : Prisma.empty;

      // 3. Build category filter if provided
      const categoryCondition = query.category
        ? Prisma.sql`AND category = ${query.category}`
        : Prisma.empty;

      // 4. Execute raw SQL query with vector similarity
      // Using cosine distance operator (<=>)
      const results = await prisma.$queryRaw<any[]>`
        SELECT
          id,
          title,
          description,
          price,
          category,
          features,
          1 - (embedding <=> ${embeddingString}::vector) as similarity
        FROM "Listing"
        WHERE
          status = 'AVAILABLE'
          ${categoryCondition}
          ${priceCondition}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingString}::vector
        LIMIT ${query.maxResults || 10}
      `;

      // 5. Transform to SearchResult format
      const searchResults: SearchResult[] = results.map(r => ({
        listingId: r.id as string,
        title: r.title as string,
        description: r.description as string,
        price: parseFloat(String(r.price)),
        similarity: parseFloat(String(r.similarity)),
        metadata: {
          category: r.category,
          features: r.features,
        },
      }));

      const duration = Date.now() - startTime;
      logger.info({
        query: query.query,
        resultsCount: searchResults.length,
        duration,
        topSimilarity: searchResults[0]?.similarity || 0
      }, 'Semantic search completed');

      return searchResults;
    } catch (error) {
      logger.error({ err: error, query }, 'Semantic search failed');
      throw error;
    }
  }

  /**
   * Index a listing for semantic search by generating and storing its embedding
   * @param listingId - ID of the listing to index
   */
  async indexListing(listingId: string): Promise<void> {
    logger.info({ listingId }, 'Indexing listing');

    const prisma = getPrismaClient();

    try {
      // 1. Fetch listing data
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
          title: true,
          description: true,
          category: true,
          features: true,
          condition: true,
        },
      });

      if (!listing) {
        throw new Error(`Listing ${listingId} not found`);
      }

      // 2. Create searchable text by combining all relevant fields
      const searchText = [
        listing.title,
        listing.description,
        listing.category,
        listing.condition,
        JSON.stringify(listing.features)
      ].join(' ');

      // 3. Generate embedding
      const embedding = await this.embeddings.generateEmbedding(searchText);

      // 4. Store embedding in database using raw SQL
      await prisma.$executeRaw`
        UPDATE "Listing"
        SET
          embedding = ${`[${embedding.join(',')}]`}::vector,
          "embeddingModel" = ${this.embeddings.getModel()},
          "embeddingGeneratedAt" = NOW()
        WHERE id = ${listingId}
      `;

      logger.info({
        listingId,
        textLength: searchText.length,
        model: this.embeddings.getModel()
      }, 'Listing indexed successfully');
    } catch (error) {
      logger.error({ err: error, listingId }, 'Listing indexing failed');
      throw error;
    }
  }

  /**
   * Batch index multiple listings
   * @param listingIds - Array of listing IDs to index
   * @returns Number of successfully indexed listings
   */
  async batchIndexListings(listingIds: string[]): Promise<number> {
    logger.info({ count: listingIds.length }, 'Starting batch indexing');

    let successCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const listingId of listingIds) {
      try {
        await this.indexListing(listingId);
        successCount++;
      } catch (error) {
        errors.push({
          id: listingId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info({
      total: listingIds.length,
      success: successCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined
    }, 'Batch indexing completed');

    return successCount;
  }

  /**
   * Re-index all available listings
   * @returns Number of successfully indexed listings
   */
  async reindexAll(): Promise<number> {
    logger.info('Re-indexing all available listings');

    const prisma = getPrismaClient();

    try {
      const listings = await prisma.listing.findMany({
        where: { status: 'AVAILABLE' },
        select: { id: true },
      });

      const listingIds = listings.map(l => l.id);
      return await this.batchIndexListings(listingIds);
    } catch (error) {
      logger.error({ err: error }, 'Failed to re-index all listings');
      throw error;
    }
  }
}

// Singleton instance
let searchAgentInstance: MarketplaceSearchAgent | null = null;

/**
 * Get or create the search agent instance
 */
export function getSearchAgent(): MarketplaceSearchAgent {
  if (!searchAgentInstance) {
    searchAgentInstance = new MarketplaceSearchAgent();
  }
  return searchAgentInstance;
}
