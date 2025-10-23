/**
 * Tests for HyperSync Analytics Service
 *
 * Mocks GraphQL queries and tests the analytics service logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketAnalyticsService, type MarketEvent } from '../hypersync.service';
import * as graphqlClient from '../../graphql/client';

// Mock the GraphQL client
vi.mock('../../graphql/client', () => ({
  executeQuery: vi.fn(),
  checkGraphQLHealth: vi.fn(),
}));

// Mock logger to avoid console output in tests
vi.mock('../../utils/logger', () => ({
  loggers: {
    envio: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
  logUtils: {
    logPerformance: vi.fn(),
  },
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('MarketAnalyticsService', () => {
  let service: MarketAnalyticsService;
  const mockExecuteQuery = vi.mocked(graphqlClient.executeQuery);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MarketAnalyticsService();
  });

  describe('getAgentPerformance', () => {
    it('should aggregate agent performance data from GraphQL', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';

      // Mock listing events response
      mockExecuteQuery.mockResolvedValueOnce({
        listingEvents: [
          {
            id: '1',
            chainId: 31337,
            price: '1000000000000000000', // 1 ETH
            timestamp: '1700000000',
          },
          {
            id: '2',
            chainId: 31337,
            price: '2000000000000000000', // 2 ETH
            timestamp: '1700000100',
          },
        ],
      });

      // Mock purchase events response
      mockExecuteQuery.mockResolvedValueOnce({
        purchaseEvents: [
          {
            id: '3',
            chainId: 421614,
            amount: '500000000000000000', // 0.5 ETH
            timestamp: '1700000200',
          },
        ],
      });

      const performance = await service.getAgentPerformance(mockAddress);

      expect(performance.agentAddress).toBe(mockAddress);
      expect(performance.totalTransactions).toBe(3);
      expect(performance.totalVolume).toBe(3500000000000000000n); // 3.5 ETH
      expect(performance.chainBreakdown).toHaveLength(2);
      expect(performance.timeline).toBeDefined();

      // Verify GraphQL queries were called
      expect(mockExecuteQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle empty results gracefully', async () => {
      mockExecuteQuery.mockResolvedValueOnce({ listingEvents: [] });
      mockExecuteQuery.mockResolvedValueOnce({ purchaseEvents: [] });

      const performance = await service.getAgentPerformance('0xtest');

      expect(performance.totalTransactions).toBe(0);
      expect(performance.totalVolume).toBe(0n);
      expect(performance.chainBreakdown).toHaveLength(0);
    });

    it('should handle GraphQL errors', async () => {
      mockExecuteQuery.mockRejectedValueOnce(new Error('GraphQL query failed'));

      await expect(service.getAgentPerformance('0xtest')).rejects.toThrow('GraphQL query failed');
    });
  });

  describe('streamMarketEvents', () => {
    it('should stream events using polling', async () => {
      const events: MarketEvent[] = [];
      const callback = (event: MarketEvent) => events.push(event);

      // Mock initial query - no events
      mockExecuteQuery.mockResolvedValueOnce({ listingEvents: [] });
      mockExecuteQuery.mockResolvedValueOnce({ purchaseEvents: [] });

      // Mock second poll - new events
      mockExecuteQuery.mockResolvedValueOnce({
        listingEvents: [
          {
            listingId: 'listing1',
            seller: '0xseller',
            price: '1000000000000000000',
            blockNumber: '100',
            transactionHash: '0xtx1',
            timestamp: '1700000000',
            chainId: 31337,
          },
        ],
      });

      const unsubscribe = await service.streamMarketEvents(callback);

      // Wait for initial poll
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify unsubscribe works
      unsubscribe();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('analyzeMarketTrends', () => {
    it('should calculate market trends for time range', async () => {
      const from = new Date('2023-01-01');
      const to = new Date('2023-01-31');

      mockExecuteQuery.mockResolvedValueOnce({
        listingEvents: [
          { price: '1000000000000000000', timestamp: '1672531200' }, // Jan 1
          { price: '2000000000000000000', timestamp: '1672617600' }, // Jan 2
        ],
        purchaseEvents: [
          { amount: '1500000000000000000', timestamp: '1672704000' }, // Jan 3
        ],
        marketMetrics: {
          totalVolume: '4500000000000000000',
          totalTransactions: 3,
          averagePrice: '1500000000000000000',
        },
      });

      const trends = await service.analyzeMarketTrends({ from, to });

      expect(trends.totalVolume).toBe(4500000000000000000n); // 4.5 ETH
      expect(trends.totalTransactions).toBe(3);
      expect(trends.averagePrice).toBe(1500000000000000000n); // 1.5 ETH
      expect(trends.hourlyVolume).toBeDefined();
      expect(Array.isArray(trends.hourlyVolume)).toBe(true);
    });

    it('should handle empty time range', async () => {
      mockExecuteQuery.mockResolvedValueOnce({
        listingEvents: [],
        purchaseEvents: [],
        marketMetrics: null,
      });

      const trends = await service.analyzeMarketTrends({
        from: new Date('2023-01-01'),
        to: new Date('2023-01-01'),
      });

      expect(trends.totalVolume).toBe(0n);
      expect(trends.totalTransactions).toBe(0);
    });
  });

  describe('getRecentActivity', () => {
    it('should fetch and combine recent listing and purchase events', async () => {
      mockExecuteQuery.mockResolvedValueOnce({
        listingEvents: [
          {
            id: 'l1',
            listingId: 'listing1',
            seller: '0xseller1',
            price: '1000000000000000000',
            blockNumber: '100',
            transactionHash: '0xtx1',
            timestamp: '1700000000',
            chainId: 31337,
            type: 'CREATED',
            agentId: 'agent1',
          },
        ],
        purchaseEvents: [
          {
            id: 'p1',
            listingId: 'listing1',
            buyer: '0xbuyer1',
            seller: '0xseller1',
            amount: '1000000000000000000',
            blockNumber: '101',
            transactionHash: '0xtx2',
            timestamp: '1700000100',
            chainId: 31337,
          },
        ],
      });

      const activity = await service.getRecentActivity(10);

      expect(activity).toHaveLength(2);
      expect(activity[0]?.type).toBe('ListingPurchased'); // More recent
      expect(activity[1]?.type).toBe('ListingCreated');
    });

    it('should respect the limit parameter', async () => {
      const manyEvents = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `e${i}`,
          listingId: `listing${i}`,
          seller: '0xseller',
          price: '1000000000000000000',
          blockNumber: `${100 + i}`,
          transactionHash: `0xtx${i}`,
          timestamp: `${1700000000 + i}`,
          chainId: 31337,
          type: 'CREATED',
          agentId: 'agent1',
        }));

      mockExecuteQuery.mockResolvedValueOnce({
        listingEvents: manyEvents,
        purchaseEvents: [],
      });

      const activity = await service.getRecentActivity(5);

      expect(activity.length).toBeLessThanOrEqual(5);
    });
  });

  describe('exportMarketData', () => {
    it('should export data in JSON format', async () => {
      const exported = await service.exportMarketData('json');

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('exportedAt');
      expect(parsed.format).toBe('json');
    });

    it('should export data in CSV format', async () => {
      const exported = await service.exportMarketData('csv');

      expect(exported).toContain('timestamp,type,data');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle concurrent requests', async () => {
      mockExecuteQuery.mockResolvedValue({
        listingEvents: [],
        purchaseEvents: [],
      });

      const promises = [
        service.getRecentActivity(10),
        service.getRecentActivity(10),
        service.getRecentActivity(10),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockExecuteQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle network timeouts gracefully', async () => {
      mockExecuteQuery.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 100)
          )
      );

      await expect(service.getRecentActivity(10)).rejects.toThrow('Network timeout');
    });
  });
});
