import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleListingCreated,
  handlePurchaseInitiated,
  handleAgentRegistered,
} from './EventHandlers';

// Import fixtures
import listingCreatedFixture from '../fixtures/listingCreated.json';
import purchaseInitiatedFixture from '../fixtures/purchaseInitiated.json';
import agentRegisteredFixture from '../fixtures/agentRegistered.json';

// Mock logger
vi.mock('../../src/lib/utils/logger', () => ({
  loggers: {
    envio: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

describe('Envio Event Handlers', () => {
  let mockContext: {
    Agent: { upsert: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
    MarketMetrics: { upsert: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
    ListingEvent: { create: ReturnType<typeof vi.fn> };
    PurchaseEvent: { create: ReturnType<typeof vi.fn> };
    AgentRegistration: { create: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockContext = {
      Agent: {
        upsert: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
      },
      MarketMetrics: {
        upsert: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({
          id: 'global',
          totalListings: 0,
          totalVolume: BigInt(0),
          activeAgents24h: 0,
          averagePrice: BigInt(0),
          totalTransactions: 0,
          lastUpdated: BigInt(0),
        }),
      },
      ListingEvent: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      PurchaseEvent: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      AgentRegistration: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };

    vi.clearAllMocks();
  });

  describe('handleListingCreated', () => {
    it('should process ListingCreated event from fixture', async () => {
      const event = {
        params: listingCreatedFixture.event.params,
        transactionHash: listingCreatedFixture.transactionHash,
        blockNumber: BigInt(listingCreatedFixture.blockNumber),
        timestamp: BigInt(listingCreatedFixture.blockTimestamp),
        chainId: listingCreatedFixture.chainId,
      };

      await handleListingCreated(event, mockContext);

      // Verify Agent was updated
      expect(mockContext.Agent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: event.params.seller,
          walletAddress: event.params.seller,
          chainId: event.chainId,
        }),
      );

      // Verify ListingEvent was created
      expect(mockContext.ListingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: event.params.listingId,
          seller: event.params.seller,
          price: BigInt(event.params.price),
          chainId: event.chainId,
        }),
      );

      // Verify MarketMetrics was updated
      expect(mockContext.MarketMetrics.upsert).toHaveBeenCalled();
    });

    it('should increment agent totalListings counter', async () => {
      const event = {
        params: listingCreatedFixture.event.params,
        transactionHash: listingCreatedFixture.transactionHash,
        blockNumber: BigInt(listingCreatedFixture.blockNumber),
        timestamp: BigInt(listingCreatedFixture.blockTimestamp),
        chainId: listingCreatedFixture.chainId,
      };

      // Mock existing agent
      mockContext.Agent.get.mockResolvedValueOnce({
        id: event.params.seller,
        totalListings: 5,
        totalVolume: BigInt(1000),
      });

      await handleListingCreated(event, mockContext);

      expect(mockContext.Agent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: event.params.seller,
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      const event = {
        params: listingCreatedFixture.event.params,
        transactionHash: listingCreatedFixture.transactionHash,
        blockNumber: BigInt(listingCreatedFixture.blockNumber),
        timestamp: BigInt(listingCreatedFixture.blockTimestamp),
        chainId: listingCreatedFixture.chainId,
      };

      mockContext.Agent.upsert.mockRejectedValueOnce(new Error('Database error'));

      await expect(handleListingCreated(event, mockContext)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('handlePurchaseInitiated', () => {
    it('should process PurchaseInitiated event from fixture', async () => {
      const event = {
        params: purchaseInitiatedFixture.event.params,
        transactionHash: purchaseInitiatedFixture.transactionHash,
        blockNumber: BigInt(purchaseInitiatedFixture.blockNumber),
        timestamp: BigInt(purchaseInitiatedFixture.blockTimestamp),
        chainId: purchaseInitiatedFixture.chainId,
      };

      await handlePurchaseInitiated(event, mockContext);

      // Verify buyer Agent was updated
      expect(mockContext.Agent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: event.params.buyer,
          walletAddress: event.params.buyer,
        }),
      );

      // Verify seller Agent was updated
      expect(mockContext.Agent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: event.params.seller,
          walletAddress: event.params.seller,
        }),
      );

      // Verify PurchaseEvent was created
      expect(mockContext.PurchaseEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: event.params.listingId,
          buyer: event.params.buyer,
          seller: event.params.seller,
          amount: BigInt(event.params.amount),
        }),
      );

      // Verify MarketMetrics was updated
      expect(mockContext.MarketMetrics.upsert).toHaveBeenCalled();
    });

    it('should increment both buyer and seller counters', async () => {
      const event = {
        params: purchaseInitiatedFixture.event.params,
        transactionHash: purchaseInitiatedFixture.transactionHash,
        blockNumber: BigInt(purchaseInitiatedFixture.blockNumber),
        timestamp: BigInt(purchaseInitiatedFixture.blockTimestamp),
        chainId: purchaseInitiatedFixture.chainId,
      };

      await handlePurchaseInitiated(event, mockContext);

      // Should update both agents
      expect(mockContext.Agent.upsert).toHaveBeenCalledTimes(2);
    });

    it('should handle missing buyer gracefully', async () => {
      const event = {
        params: {
          ...purchaseInitiatedFixture.event.params,
          buyer: undefined,
        },
        transactionHash: purchaseInitiatedFixture.transactionHash,
        blockNumber: BigInt(purchaseInitiatedFixture.blockNumber),
        timestamp: BigInt(purchaseInitiatedFixture.blockTimestamp),
        chainId: purchaseInitiatedFixture.chainId,
      };

      await handlePurchaseInitiated(event, mockContext);

      // Should still update seller
      expect(mockContext.Agent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: event.params.seller,
        }),
      );
    });
  });

  describe('handleAgentRegistered', () => {
    it('should process AgentRegistered event from fixture', async () => {
      const event = {
        params: agentRegisteredFixture.event.params,
        transactionHash: agentRegisteredFixture.transactionHash,
        blockNumber: BigInt(agentRegisteredFixture.blockNumber),
        timestamp: BigInt(agentRegisteredFixture.blockTimestamp),
        chainId: agentRegisteredFixture.chainId,
      };

      await handleAgentRegistered(event, mockContext);

      // Verify Agent was created
      expect(mockContext.Agent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: event.params.agentId,
          walletAddress: event.params.walletAddress,
          chainId: event.chainId,
          totalListings: 0,
          totalPurchases: 0,
          totalVolume: BigInt(0),
        }),
      );

      // Verify AgentRegistration event was recorded
      expect(mockContext.AgentRegistration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: event.params.agentId,
          walletAddress: event.params.walletAddress,
          chainId: event.chainId,
        }),
      );
    });

    it('should handle duplicate registration gracefully', async () => {
      const event = {
        params: agentRegisteredFixture.event.params,
        transactionHash: agentRegisteredFixture.transactionHash,
        blockNumber: BigInt(agentRegisteredFixture.blockNumber),
        timestamp: BigInt(agentRegisteredFixture.blockTimestamp),
        chainId: agentRegisteredFixture.chainId,
      };

      // Mock existing agent
      mockContext.Agent.get.mockResolvedValueOnce({
        id: event.params.agentId,
        walletAddress: event.params.walletAddress,
        totalListings: 10,
      });

      await handleAgentRegistered(event, mockContext);

      // Should still complete without error
      expect(mockContext.AgentRegistration.create).toHaveBeenCalled();
    });
  });

  describe('Market Metrics Updates', () => {
    it('should increment totalListings when listing is created', async () => {
      const event = {
        params: listingCreatedFixture.event.params,
        transactionHash: listingCreatedFixture.transactionHash,
        blockNumber: BigInt(listingCreatedFixture.blockNumber),
        timestamp: BigInt(listingCreatedFixture.blockTimestamp),
        chainId: listingCreatedFixture.chainId,
      };

      await handleListingCreated(event, mockContext);

      expect(mockContext.MarketMetrics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'global',
        }),
      );
    });

    it('should track total volume from purchases', async () => {
      const event = {
        params: purchaseInitiatedFixture.event.params,
        transactionHash: purchaseInitiatedFixture.transactionHash,
        blockNumber: BigInt(purchaseInitiatedFixture.blockNumber),
        timestamp: BigInt(purchaseInitiatedFixture.blockTimestamp),
        chainId: purchaseInitiatedFixture.chainId,
      };

      await handlePurchaseInitiated(event, mockContext);

      expect(mockContext.MarketMetrics.upsert).toHaveBeenCalled();
    });
  });
});
