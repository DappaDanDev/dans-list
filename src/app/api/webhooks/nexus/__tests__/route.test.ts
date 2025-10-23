/**
 * Nexus Webhook Handler Tests
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from '../route';
import { NextRequest } from 'next/server';
import { getPrismaClient } from '@/lib/database/prisma.service';

// Mock dependencies
vi.mock('@/lib/database/prisma.service', () => ({
  getPrismaClient: vi.fn(),
}));
vi.mock('@/lib/utils/logger');

describe('Nexus Webhook Handler', () => {
  let mockPrisma: any;

  beforeEach(() => {
    // Setup Prisma mocks
    mockPrisma = {
      transaction: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      listing: {
        update: vi.fn(),
      },
    };

    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma);
  });

  describe('POST /api/webhooks/nexus', () => {
    test('updates transaction status on CONFIRMED webhook', async () => {
      const payload = {
        nexusId: 'nexus_123',
        transactionHash: '0xconfirmed123',
        status: 'CONFIRMED' as const,
        sourceChain: 84532,
        destinationChain: 84532,
        timestamp: Date.now(),
      };

      // Mock existing transaction
      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'tx-1',
        hash: '0xpending_123',
        status: 'PENDING',
        listingId: 'listing-1',
      });

      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-1',
        hash: '0xconfirmed123',
        status: 'CONFIRMED',
      });

      mockPrisma.listing.update.mockResolvedValue({
        id: 'listing-1',
        status: 'SOLD',
      });

      const request = new NextRequest('http://localhost:3000/api/webhooks/nexus', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.transactionId).toBe('tx-1');
      expect(data.status).toBe('CONFIRMED');

      // Verify transaction was updated
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: expect.objectContaining({
          status: 'CONFIRMED',
          hash: '0xconfirmed123',
        }),
      });

      // Verify listing was marked as SOLD
      expect(mockPrisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: { status: 'SOLD' },
      });
    });

    test('updates transaction status on FAILED webhook', async () => {
      const payload = {
        nexusId: 'nexus_456',
        transactionHash: '0xfailed456',
        status: 'FAILED' as const,
        sourceChain: 84532,
        destinationChain: 84532,
        timestamp: Date.now(),
        error: 'Insufficient gas',
      };

      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'tx-2',
        hash: '0xpending_456',
        status: 'PENDING',
        listingId: 'listing-2',
      });

      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-2',
        hash: '0xfailed456',
        status: 'FAILED',
      });

      mockPrisma.listing.update.mockResolvedValue({
        id: 'listing-2',
        status: 'AVAILABLE',
      });

      const request = new NextRequest('http://localhost:3000/api/webhooks/nexus', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify transaction was marked as FAILED
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-2' },
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      });

      // Verify listing was marked as AVAILABLE again
      expect(mockPrisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-2' },
        data: { status: 'AVAILABLE' },
      });
    });

    test('handles PENDING status without updating listing', async () => {
      const payload = {
        nexusId: 'nexus_789',
        transactionHash: '0xpending789',
        status: 'PENDING' as const,
        sourceChain: 84532,
        destinationChain: 84532,
        timestamp: Date.now(),
      };

      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'tx-3',
        hash: '0xpending_789',
        status: 'PENDING',
        listingId: 'listing-3',
      });

      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-3',
        status: 'PENDING',
      });

      const request = new NextRequest('http://localhost:3000/api/webhooks/nexus', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify transaction was updated
      expect(mockPrisma.transaction.update).toHaveBeenCalled();

      // Verify listing was NOT updated (PENDING doesn't trigger listing status change)
      expect(mockPrisma.listing.update).not.toHaveBeenCalled();
    });

    test('returns 404 when transaction not found', async () => {
      const payload = {
        nexusId: 'nexus_notfound',
        transactionHash: '0xnotfound',
        status: 'CONFIRMED' as const,
        sourceChain: 84532,
        destinationChain: 84532,
        timestamp: Date.now(),
      };

      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/webhooks/nexus', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Transaction not found');

      // Verify no updates were attempted
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
      expect(mockPrisma.listing.update).not.toHaveBeenCalled();
    });

    test('handles database errors gracefully', async () => {
      const payload = {
        nexusId: 'nexus_error',
        transactionHash: '0xerror',
        status: 'CONFIRMED' as const,
        sourceChain: 84532,
        destinationChain: 84532,
        timestamp: Date.now(),
      };

      mockPrisma.transaction.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/webhooks/nexus', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.message).toContain('Database connection failed');
    });

    test('handles transactions without listing ID', async () => {
      const payload = {
        nexusId: 'nexus_nolisting',
        transactionHash: '0xnolisting',
        status: 'CONFIRMED' as const,
        sourceChain: 84532,
        destinationChain: 84532,
        timestamp: Date.now(),
      };

      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'tx-4',
        hash: '0xpending_4',
        status: 'PENDING',
        listingId: null, // No listing associated
      });

      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-4',
        status: 'CONFIRMED',
      });

      const request = new NextRequest('http://localhost:3000/api/webhooks/nexus', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify transaction was updated
      expect(mockPrisma.transaction.update).toHaveBeenCalled();

      // Verify listing update was NOT attempted (no listingId)
      expect(mockPrisma.listing.update).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/webhooks/nexus', () => {
    test('returns health check', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service).toBe('nexus-webhook');
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
    });
  });
});
