import { loggers, logUtils } from '../utils/logger';
import { executeQuery } from '../graphql/client';
import {
  TOP_AGENTS_QUERY,
  RECENT_TRANSACTIONS_QUERY,
  MARKET_METRICS_QUERY,
  type Agent,
  type ListingEvent,
  type PurchaseEvent,
  type MarketMetrics,
} from '../graphql/queries';
import type { TransactionStatus } from '../monitoring/blockscout.service';

const logger = loggers.envio;

/**
 * Market event types from blockchain
 */
export interface MarketEvent {
  type: 'ListingCreated' | 'ListingPurchased' | 'MarketplaceFeeUpdated';
  listingId?: string;
  seller?: string;
  buyer?: string;
  price?: bigint;
  blockNumber: bigint;
  transactionHash: string;
  timestamp: number;
  chainId: number;
}

/**
 * Agent performance metrics
 */
export interface AgentPerformance {
  agentAddress: string;
  totalTransactions: number;
  totalVolume: bigint;
  chainBreakdown: {
    chainId: number;
    transactions: number;
    volume: bigint;
  }[];
  timeline: {
    date: string;
    transactions: number;
    volume: bigint;
  }[];
}

/**
 * Market trends data
 */
export interface MarketTrends {
  totalVolume: bigint;
  totalTransactions: number;
  averagePrice: bigint;
  topCategories: string[];
  hourlyVolume: { hour: string; volume: bigint }[];
}

/**
 * HyperSync Analytics Service for ultra-fast blockchain data indexing
 * Uses Envio GraphQL API for querying indexed blockchain data
 */
export class MarketAnalyticsService {
  private readonly MARKETPLACE_ADDRESS: string;
  private readonly SUPPORTED_CHAINS = [31337, 421614, 42161, 137, 8453]; // Local, Arbitrum Sepolia, Arbitrum One, Polygon, Base

  constructor() {
    // Get marketplace address from environment or use placeholder
    this.MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS || '0x0000000000000000000000000000000000000001';

    logger.info(
      {
        marketplace: this.MARKETPLACE_ADDRESS,
        chains: this.SUPPORTED_CHAINS
      },
      'HyperSync analytics service initialized'
    );
  }

  /**
   * Get agent performance across all chains
   */
  async getAgentPerformance(agentAddress: string): Promise<AgentPerformance> {
    const startTime = Date.now();
    logger.info({ agentAddress }, 'Fetching agent performance');

    try {
      // Query for agent's selling activity (listings)
      const listingsResult = await executeQuery<{ listingEvents: ListingEvent[] }>(
        `query AgentListings($seller: String!) {
          listingEvents(where: { seller: $seller }, first: 1000) {
            id
            chainId
            price
            timestamp
          }
        }`,
        { seller: agentAddress }
      );

      // Query for agent's buying activity (purchases)
      const purchasesResult = await executeQuery<{ purchaseEvents: PurchaseEvent[] }>(
        `query AgentPurchases($buyer: String!) {
          purchaseEvents(where: { buyer: $buyer }, first: 1000) {
            id
            chainId
            amount
            timestamp
          }
        }`,
        { buyer: agentAddress }
      );

      const listings = listingsResult.listingEvents || [];
      const purchases = purchasesResult.purchaseEvents || [];

      // Aggregate chain data
      const chainData = new Map<number, { transactions: number; volume: bigint }>();

      for (const listing of listings) {
        const data = chainData.get(listing.chainId) || { transactions: 0, volume: 0n };
        data.transactions++;
        data.volume += BigInt(listing.price);
        chainData.set(listing.chainId, data);
      }

      for (const purchase of purchases) {
        const data = chainData.get(purchase.chainId) || { transactions: 0, volume: 0n };
        data.transactions++;
        data.volume += BigInt(purchase.amount);
        chainData.set(purchase.chainId, data);
      }

      // Calculate totals
      const totalTransactions = listings.length + purchases.length;
      const totalVolume = Array.from(chainData.values()).reduce(
        (sum, data) => sum + data.volume,
        0n
      );

      // Generate activity timeline
      const allEvents = [
        ...listings.map(l => ({ timestamp: l.timestamp, volume: BigInt(l.price) })),
        ...purchases.map(p => ({ timestamp: p.timestamp, volume: BigInt(p.amount) })),
      ].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

      const timeline = this.generateActivityTimeline(allEvents);

      const performance: AgentPerformance = {
        agentAddress,
        totalTransactions,
        totalVolume,
        chainBreakdown: Array.from(chainData.entries()).map(([chainId, data]) => ({
          chainId,
          transactions: data.transactions,
          volume: data.volume,
        })),
        timeline,
      };

      const duration = Date.now() - startTime;
      logUtils.logPerformance('getAgentPerformance', duration, { agentAddress });

      return performance;
    } catch (error) {
      logger.error({ err: error, agentAddress }, 'Failed to fetch agent performance');
      throw error;
    }
  }

  /**
   * Stream real-time market events
   */
  async streamMarketEvents(callback: (event: MarketEvent) => void): Promise<() => void> {
    logger.info('Starting market event stream');

    let isActive = true;
    let lastBlockNumber = 0n;

    const pollForEvents = async () => {
      try {
        // Query for new listing events
        const listingsResult = await executeQuery<{ listingEvents: ListingEvent[] }>(
          `query RecentListings($minBlock: BigInt!) {
            listingEvents(
              where: { blockNumber_gt: $minBlock }
              orderBy: "blockNumber"
              first: 100
            ) {
              listingId
              seller
              price
              blockNumber
              transactionHash
              timestamp
              chainId
            }
          }`,
          { minBlock: lastBlockNumber.toString() }
        );

        // Query for new purchase events
        const purchasesResult = await executeQuery<{ purchaseEvents: PurchaseEvent[] }>(
          `query RecentPurchases($minBlock: BigInt!) {
            purchaseEvents(
              where: { blockNumber_gt: $minBlock }
              orderBy: "blockNumber"
              first: 100
            ) {
              listingId
              buyer
              seller
              amount
              blockNumber
              transactionHash
              timestamp
              chainId
            }
          }`,
          { minBlock: lastBlockNumber.toString() }
        );

        // Convert to MarketEvent format and call callback
        for (const listing of listingsResult.listingEvents || []) {
          callback({
            type: 'ListingCreated',
            listingId: listing.listingId,
            seller: listing.seller,
            price: BigInt(listing.price),
            blockNumber: BigInt(listing.blockNumber),
            transactionHash: listing.transactionHash,
            timestamp: Number(listing.timestamp),
            chainId: listing.chainId,
          });

          lastBlockNumber = BigInt(listing.blockNumber);
        }

        for (const purchase of purchasesResult.purchaseEvents || []) {
          callback({
            type: 'ListingPurchased',
            listingId: purchase.listingId,
            seller: purchase.seller,
            buyer: purchase.buyer,
            price: BigInt(purchase.amount),
            blockNumber: BigInt(purchase.blockNumber),
            transactionHash: purchase.transactionHash,
            timestamp: Number(purchase.timestamp),
            chainId: purchase.chainId,
          });

          lastBlockNumber = BigInt(purchase.blockNumber);
        }
      } catch (error) {
        logger.error({ err: error }, 'Failed to poll for events');
      }

      // Continue polling if active
      if (isActive) {
        setTimeout(pollForEvents, 5000); // Poll every 5 seconds
      }
    };

    // Start polling
    pollForEvents();

    // Return unsubscribe function
    return () => {
      isActive = false;
      logger.info('Stopping market event stream');
    };
  }

  /**
   * Analyze market trends over time
   */
  async analyzeMarketTrends(timeRange: { from: Date; to: Date }): Promise<MarketTrends> {
    const startTime = Date.now();
    logger.info({ timeRange }, 'Analyzing market trends');

    try {
      const fromTimestamp = Math.floor(timeRange.from.getTime() / 1000);
      const toTimestamp = Math.floor(timeRange.to.getTime() / 1000);

      // Query for all events in time range
      const result = await executeQuery<{
        listingEvents: ListingEvent[];
        purchaseEvents: PurchaseEvent[];
        marketMetrics: MarketMetrics | null;
      }>(
        `query MarketTrends($from: BigInt!, $to: BigInt!) {
          listingEvents(where: { timestamp_gte: $from, timestamp_lte: $to }) {
            price
            timestamp
          }
          purchaseEvents(where: { timestamp_gte: $from, timestamp_lte: $to }) {
            amount
            timestamp
          }
          marketMetrics(id: "global") {
            totalVolume
            totalTransactions
            averagePrice
          }
        }`,
        { from: fromTimestamp.toString(), to: toTimestamp.toString() }
      );

      const listings = result.listingEvents || [];
      const purchases = result.purchaseEvents || [];

      // Calculate volume and trends
      const totalVolume =
        listings.reduce((sum, l) => sum + BigInt(l.price), 0n) +
        purchases.reduce((sum, p) => sum + BigInt(p.amount), 0n);

      const totalTransactions = listings.length + purchases.length;

      const averagePrice = totalTransactions > 0 ? totalVolume / BigInt(totalTransactions) : 0n;

      // Group by hour for hourly volume
      const hourlyData = new Map<string, bigint>();

      for (const listing of listings) {
        const hour = new Date(Number(listing.timestamp) * 1000).toISOString().slice(0, 13);
        hourlyData.set(hour, (hourlyData.get(hour) || 0n) + BigInt(listing.price));
      }

      for (const purchase of purchases) {
        const hour = new Date(Number(purchase.timestamp) * 1000).toISOString().slice(0, 13);
        hourlyData.set(hour, (hourlyData.get(hour) || 0n) + BigInt(purchase.amount));
      }

      const hourlyVolume = Array.from(hourlyData.entries())
        .map(([hour, volume]) => ({ hour, volume }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      const trends: MarketTrends = {
        totalVolume,
        totalTransactions,
        averagePrice,
        topCategories: [], // Would need category data in GraphQL schema
        hourlyVolume,
      };

      const duration = Date.now() - startTime;
      logUtils.logPerformance('analyzeMarketTrends', duration);

      return trends;
    } catch (error) {
      logger.error({ err: error, timeRange }, 'Failed to analyze market trends');
      throw error;
    }
  }

  /**
   * Get recent market activity
   */
  async getRecentActivity(limit: number = 50): Promise<MarketEvent[]> {
    logger.debug({ limit }, 'Fetching recent market activity');

    try {
      const result = await executeQuery<{
        listingEvents: ListingEvent[];
        purchaseEvents: PurchaseEvent[];
      }>(RECENT_TRANSACTIONS_QUERY, { first: limit });

      const events: MarketEvent[] = [];

      // Add listing events
      for (const listing of result.listingEvents || []) {
        events.push({
          type: 'ListingCreated',
          listingId: listing.listingId,
          seller: listing.seller,
          price: BigInt(listing.price),
          blockNumber: BigInt(listing.blockNumber),
          transactionHash: listing.transactionHash,
          timestamp: Number(listing.timestamp),
          chainId: listing.chainId,
        });
      }

      // Add purchase events
      for (const purchase of result.purchaseEvents || []) {
        events.push({
          type: 'ListingPurchased',
          listingId: purchase.listingId,
          buyer: purchase.buyer,
          seller: purchase.seller,
          price: BigInt(purchase.amount),
          blockNumber: BigInt(purchase.blockNumber),
          transactionHash: purchase.transactionHash,
          timestamp: Number(purchase.timestamp),
          chainId: purchase.chainId,
        });
      }

      // Sort by timestamp descending
      events.sort((a, b) => b.timestamp - a.timestamp);

      return events.slice(0, limit);
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch recent activity');
      throw error;
    }
  }

  /**
   * Export market data for analysis
   */
  async exportMarketData(format: 'json' | 'csv' = 'json'): Promise<string> {
    logger.info({ format }, 'Exporting market data');

    try {
      // Implementation would export data in specified format
      const data = {
        exportedAt: new Date().toISOString(),
        format,
        // Additional data would be added here
      };

      return format === 'json'
        ? JSON.stringify(data, null, 2)
        : 'timestamp,type,data\n'; // CSV header
    } catch (error) {
      logger.error({ err: error, format }, 'Failed to export market data');
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private generateActivityTimeline(
    events: Array<{ timestamp: string; volume: bigint }>
  ): Array<{ date: string; transactions: number; volume: bigint }> {
    // Group events by date
    const dailyData = new Map<string, { transactions: number; volume: bigint }>();

    for (const event of events) {
      const date = new Date(Number(event.timestamp) * 1000).toISOString().slice(0, 10);
      const existing = dailyData.get(date) || { transactions: 0, volume: 0n };
      existing.transactions++;
      existing.volume += event.volume;
      dailyData.set(date, existing);
    }

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        transactions: data.transactions,
        volume: data.volume,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

// Singleton instance
let analyticsServiceInstance: MarketAnalyticsService | null = null;

/**
 * Get or create the analytics service instance
 */
export function getAnalyticsService(): MarketAnalyticsService {
  if (!analyticsServiceInstance) {
    analyticsServiceInstance = new MarketAnalyticsService();
  }
  return analyticsServiceInstance;
}