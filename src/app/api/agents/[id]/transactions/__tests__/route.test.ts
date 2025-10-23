/**
 * Transaction History API Tests
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { GET, HEAD } from '../route';
import { NextRequest } from 'next/server';
import { getPrismaClient } from '@/lib/database/prisma.service';

// Mock dependencies
vi.mock('@/lib/database/prisma.service', () => ({
  getPrismaClient: vi.fn(),
}));
vi.mock('@/lib/utils/logger');

describe('Transaction History API', () => {
  let mockPrisma: any;

  const mockAgent = {
    id: 'agent-1',
    type: 'BUYER',
    walletAddress: '0x1234567890123456789012345678901234567890',
    vincentPkpId: 'pkp-123',
    eigenAvsId: null,
    policies: {},
    spendingLimit: 1000,
    dailyLimit: 100,
    totalTransactions: 5,
    successRate: 100,
    totalVolume: 500,
    lastActivity: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTransactions = [
    {
      id: 'tx-1',
      hash: '0xtx1',
      fromAgentId: 'agent-2',
      toAgentId: 'agent-1',
      listingId: 'listing-1',
      amount: 100,
      token: 'PYUSD',
      sourceChain: 84532,
      destinationChain: 84532,
      nexusRouteId: null,
      nexusSteps: null,
      bridgeFee: null,
      swapFee: null,
      status: 'CONFIRMED',
      blockNumber: BigInt(1000),
      gasUsed: BigInt(21000),
      errorMessage: null,
      createdAt: new Date('2024-01-01'),
      confirmedAt: new Date('2024-01-01'),
      fromAgent: {
        id: 'agent-2',
        type: 'SELLER',
        walletAddress: '0xseller',
      },
      toAgent: {
        id: 'agent-1',
        type: 'BUYER',
        walletAddress: '0x1234567890123456789012345678901234567890',
      },
      listing: {
        id: 'listing-1',
        title: 'Test Listing',
        price: 100,
        status: 'SOLD',
        imageUrl: 'https://example.com/image.jpg',
      },
    },
    {
      id: 'tx-2',
      hash: '0xtx2',
      fromAgentId: 'agent-1',
      toAgentId: 'agent-3',
      listingId: 'listing-2',
      amount: 50,
      token: 'PYUSD',
      sourceChain: 84532,
      destinationChain: 421614,
      nexusRouteId: 'nexus-123',
      nexusSteps: [{ step: 1, action: 'bridge' }],
      bridgeFee: 1,
      swapFee: 0.5,
      status: 'PENDING',
      blockNumber: null,
      gasUsed: null,
      errorMessage: null,
      createdAt: new Date('2024-01-02'),
      confirmedAt: null,
      fromAgent: {
        id: 'agent-1',
        type: 'BUYER',
        walletAddress: '0x1234567890123456789012345678901234567890',
      },
      toAgent: {
        id: 'agent-3',
        type: 'SELLER',
        walletAddress: '0xseller2',
      },
      listing: {
        id: 'listing-2',
        title: 'Another Listing',
        price: 50,
        status: 'PENDING',
        imageUrl: 'https://example.com/image2.jpg',
      },
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      agent: {
        findUnique: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
    };

    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma);
  });

  describe('GET /api/agents/[id]/transactions', () => {
    test('returns transaction history for valid agent', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.transaction.count.mockResolvedValue(2);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0x1234567890123456789012345678901234567890/transactions'
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: '0x1234567890123456789012345678901234567890' }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agent.address).toBe(mockAgent.walletAddress);
      expect(data.transactions).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
      expect(data.summary.totalTransactions).toBe(2);

      // Verify transaction formatting
      expect(data.transactions[0]).toMatchObject({
        id: 'tx-1',
        hash: '0xtx1',
        type: 'RECEIVED',
        status: 'CONFIRMED',
      });

      expect(data.transactions[1]).toMatchObject({
        id: 'tx-2',
        hash: '0xtx2',
        type: 'SENT',
        status: 'PENDING',
      });
    });

    test('handles pagination parameters', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransactions[0]]);
      mockPrisma.transaction.count.mockResolvedValue(10);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0x1234567890123456789012345678901234567890/transactions?limit=1&offset=5'
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: '0x1234567890123456789012345678901234567890' }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toMatchObject({
        limit: 1,
        offset: 5,
        total: 10,
        hasMore: true,
      });

      // Verify Prisma was called with correct pagination
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
          skip: 5,
        })
      );
    });

    test('enforces maximum limit of 100', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0x1234567890123456789012345678901234567890/transactions?limit=500'
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: '0x1234567890123456789012345678901234567890' }),
      });

      const data = await response.json();

      expect(data.pagination.limit).toBe(100);
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    test('filters by transaction status', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransactions[0]]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0x1234567890123456789012345678901234567890/transactions?status=CONFIRMED'
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: '0x1234567890123456789012345678901234567890' }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'CONFIRMED',
          }),
        })
      );
    });

    test('returns 404 when agent not found', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0xnotfound/transactions'
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: '0xnotfound' }),
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Agent not found');
    });

    test('includes nexus route details for cross-chain transactions', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransactions[1]]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0x1234567890123456789012345678901234567890/transactions'
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: '0x1234567890123456789012345678901234567890' }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.transactions[0].nexusRoute).toMatchObject({
        id: 'nexus-123',
        steps: [{ step: 1, action: 'bridge' }],
        bridgeFee: '1',
        swapFee: '0.5',
      });
    });

    test('calculates summary statistics correctly', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.transaction.count.mockResolvedValue(2);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0x1234567890123456789012345678901234567890/transactions'
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: '0x1234567890123456789012345678901234567890' }),
      });

      const data = await response.json();

      expect(data.summary).toMatchObject({
        totalTransactions: 2,
        sent: 1,
        received: 1,
        pending: 1,
        confirmed: 1,
        failed: 0,
      });
    });

    test('handles database errors gracefully', async () => {
      mockPrisma.agent.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0x1234567890123456789012345678901234567890/transactions'
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: '0x1234567890123456789012345678901234567890' }),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.message).toContain('Database connection failed');
    });
  });

  describe('HEAD /api/agents/[id]/transactions', () => {
    test('returns aggregated transaction statistics', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({
          _sum: { amount: 150 },
          _count: 3,
        })
        .mockResolvedValueOnce({
          _sum: { amount: 200 },
          _count: 2,
        });
      mockPrisma.transaction.groupBy.mockResolvedValue([
        { status: 'CONFIRMED', _count: 3 },
        { status: 'PENDING', _count: 1 },
        { status: 'FAILED', _count: 1 },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0x1234567890123456789012345678901234567890/transactions'
      );

      const response = await HEAD(request, {
        params: Promise.resolve({ id: '0x1234567890123456789012345678901234567890' }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agent.address).toBe(mockAgent.walletAddress);
      expect(data.sent).toMatchObject({
        count: 3,
        totalAmount: '150',
      });
      expect(data.received).toMatchObject({
        count: 2,
        totalAmount: '200',
      });
      expect(data.byStatus).toMatchObject({
        CONFIRMED: 3,
        PENDING: 1,
        FAILED: 1,
      });
    });

    test('returns 404 when agent not found', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0xnotfound/transactions'
      );

      const response = await HEAD(request, {
        params: Promise.resolve({ id: '0xnotfound' }),
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Agent not found');
    });

    test('handles null aggregate values', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.transaction.aggregate
        .mockResolvedValueOnce({
          _sum: { amount: null },
          _count: 0,
        })
        .mockResolvedValueOnce({
          _sum: { amount: null },
          _count: 0,
        });
      mockPrisma.transaction.groupBy.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/agents/0x1234567890123456789012345678901234567890/transactions'
      );

      const response = await HEAD(request, {
        params: Promise.resolve({ id: '0x1234567890123456789012345678901234567890' }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sent.totalAmount).toBe('0');
      expect(data.received.totalAmount).toBe('0');
    });
  });
});
