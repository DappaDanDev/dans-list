/**
 * Agent Policy Enforcement Tests
 * Tests Vincent wallet policy enforcement across agents and A2A protocol
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BuyerAgent } from '../buyer/agent';
import { SellerAgent } from '../seller/agent';
import { A2AServer } from '../a2a/server';
import { VincentWalletService } from '@/lib/vincent/wallet.service';
import { A2AClient } from '../a2a/client';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { getNexusService } from '@/lib/nexus/service';
import type { AgentWalletPolicy } from '@/lib/vincent/types';
import { DEFAULT_POLICY } from '@/lib/vincent/types';
import { ErrorCodes } from '../a2a/types';
import { ethers } from 'ethers';

// Mock dependencies
vi.mock('@lit-protocol/lit-node-client');
vi.mock('@/lib/utils/logger');
vi.mock('@/lib/database/prisma.service', () => ({
  getPrismaClient: vi.fn(),
}));
vi.mock('@nexus-sdk/client', () => ({
  NexusClient: vi.fn(),
}));
// Mock the entire Nexus service to avoid importing Vincent Signer/Provider
vi.mock('@/lib/nexus/service', () => ({
  NexusService: class MockNexusService {},
  getNexusService: vi.fn(),
}));

describe('Agent Policy Enforcement', () => {
  let mockPrisma: any;
  let mockVincentService: any;
  let mockA2AClient: any;
  let mockNexusService: any;

  beforeEach(() => {
    // Setup Prisma mocks
    mockPrisma = {
      agent: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      listing: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      transaction: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      proof: {
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      message: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
      $disconnect: vi.fn(),
    };

    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma);

    // Setup Vincent service mocks
    mockVincentService = {
      ensureWallet: vi.fn(),
      signTypedData: vi.fn(),
      setPolicy: vi.fn(),
      verifyWalletOwnership: vi.fn(),
    };

    // Setup A2A client mocks
    mockA2AClient = {
      call: vi.fn(),
    };

    // Setup Nexus service mocks with default responses
    mockNexusService = {
      executeTransaction: vi.fn().mockResolvedValue({
        transactionHash: '0xdefaultnexus',
        status: 'PENDING',
        nexusId: 'nexus_default',
      }),
      getTransactionStatus: vi.fn(),
      estimateFees: vi.fn(),
    };

    // Mock getNexusService to return our mock
    vi.mocked(getNexusService).mockReturnValue(mockNexusService as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('BuyerAgent Policy Enforcement', () => {
    test('rejects purchase exceeding maxTransactionValue', async () => {
      const agentId = 'buyer-agent-1';
      const listingId = 'listing-expensive';

      // Create buyer agent with injected dependencies
      const buyerAgent = new BuyerAgent(
        agentId,
        mockVincentService as any,
        mockA2AClient as any,
        mockNexusService as any,
        mockPrisma
      );

      // Mock wallet with policy limiting to 10 ETH
      const restrictivePolicy: AgentWalletPolicy = {
        ...DEFAULT_POLICY,
        maxTransactionValue: ethers.parseEther('10').toString(), // 10 ETH limit (in wei)
      };

      mockVincentService.ensureWallet.mockResolvedValue({
        pkpId: 'pkp_buyer1',
        address: '0xbuyer1',
        policies: restrictivePolicy,
      });

      // Mock agent with restrictive policy
      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        type: 'BUYER',
        policies: restrictivePolicy,
      });

      // Mock expensive listing (50 ETH in wei, exceeds 10 ETH limit)
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: listingId,
        price: ethers.parseEther('50').toString(), // 50 ETH in wei
        status: 'AVAILABLE',
        sellerAgentId: 'seller-agent-1',
      });

      // Mock no existing pending transactions
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      // Attempt purchase - should fail policy check
      await expect(buyerAgent.executePurchase(listingId)).rejects.toThrow(
        /exceeds transaction limit/i
      );

      // Verify transaction was NOT created
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    test('allows purchase within policy limits', async () => {
      const agentId = 'buyer-agent-2';
      const listingId = 'listing-affordable';

      const buyerAgent = new BuyerAgent(
        agentId,
        mockVincentService as any,
        mockA2AClient as any,
        mockPrisma
      );

      // Mock wallet with generous policy
      const generousPolicy: AgentWalletPolicy = {
        ...DEFAULT_POLICY,
        maxTransactionValue: ethers.parseEther('100').toString(), // 100 ETH limit
      };

      mockVincentService.ensureWallet
        .mockResolvedValueOnce({
          pkpId: 'pkp_buyer2',
          address: '0xbuyer2',
          policies: generousPolicy,
        })
        .mockResolvedValueOnce({
          pkpId: 'pkp_seller1',
          address: '0xseller1',
          policies: DEFAULT_POLICY,
        });

      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        type: 'BUYER',
        policies: generousPolicy,
      });

      // Mock affordable listing (5 ETH in wei, within 100 ETH limit)
      mockPrisma.listing.findUnique.mockResolvedValue({
        id: listingId,
        price: ethers.parseEther('5').toString(), // 5 ETH in wei
        status: 'AVAILABLE',
        sellerAgentId: 'seller-agent-1',
      });

      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      mockVincentService.signTypedData.mockResolvedValue('0xproofsignature');

      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-1',
        hash: '0xpending_123',
      });

      mockPrisma.proof.updateMany.mockResolvedValue({ count: 1 });

      // Mock Nexus transaction execution
      mockNexusService.executeTransaction.mockResolvedValue({
        transactionHash: '0xnexushash123',
        status: 'PENDING',
        nexusId: 'nexus_123',
      });

      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-1',
        hash: '0xnexushash123',
        status: 'PENDING',
      });

      // Attempt purchase - should succeed
      const txHash = await buyerAgent.executePurchase(listingId);

      expect(txHash).toBe('0xnexushash123');
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromAgentId: agentId,
          listingId,
          status: 'PENDING',
        }),
      });
    });

    test('prevents duplicate pending transactions', async () => {
      const agentId = 'buyer-agent-3';
      const listingId = 'listing-duplicate-check';

      const buyerAgent = new BuyerAgent(
        agentId,
        mockVincentService as any,
        mockA2AClient as any,
        mockPrisma
      );

      mockVincentService.ensureWallet.mockResolvedValue({
        pkpId: 'pkp_buyer3',
        address: '0xbuyer3',
        policies: DEFAULT_POLICY,
      });

      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        type: 'BUYER',
        policies: DEFAULT_POLICY,
      });

      mockPrisma.listing.findUnique.mockResolvedValue({
        id: listingId,
        price: ethers.parseEther('5').toString(), // 5 ETH in wei
        status: 'AVAILABLE',
        sellerAgentId: 'seller-agent-1',
      });

      // Mock existing pending transaction
      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'existing-tx',
        status: 'PENDING',
        listingId,
        fromAgentId: agentId,
      });

      // Attempt purchase - should fail duplicate check
      await expect(buyerAgent.executePurchase(listingId)).rejects.toThrow(
        /already in progress/i
      );

      // Verify no new transaction created
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('SellerAgent Policy Management', () => {
    test('setPolicyThresholds syncs to Vincent and database', async () => {
      const agentId = 'seller-agent-1';

      const sellerAgent = new SellerAgent(
        agentId,
        mockVincentService as any,
        {} as any, // searchAgent not needed for this test
        mockPrisma
      );

      mockPrisma.agent.update.mockResolvedValue({
        id: agentId,
        policies: expect.any(Object),
      });

      mockVincentService.setPolicy.mockResolvedValue(undefined);

      // Set policy thresholds
      const maxPrice = 50; // 50 ETH
      const dailyLimit = 200; // 200 ETH
      const approvedContracts = ['0xcontract1', '0xcontract2'];

      await sellerAgent.setPolicyThresholds(maxPrice, dailyLimit, approvedContracts);

      // Verify Vincent service called with correct policy
      expect(mockVincentService.setPolicy).toHaveBeenCalledWith(
        agentId,
        expect.objectContaining({
          maxTransactionValue: ethers.parseEther('50').toString(),
          dailySpendingLimit: ethers.parseEther('200').toString(),
          approvedContractAddresses: approvedContracts,
          maxGasPrice: ethers.parseUnits('50', 'gwei').toString(),
          allowedTokens: ['PYUSD', 'ETH'],
        })
      );

      // Verify database updated
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: agentId },
        data: expect.objectContaining({
          policies: expect.any(Object),
          spendingLimit: maxPrice,
          dailyLimit: dailyLimit,
        }),
      });
    });

    test('setPolicyThresholds handles errors gracefully', async () => {
      const agentId = 'seller-agent-error';

      const sellerAgent = new SellerAgent(
        agentId,
        mockVincentService as any,
        {} as any,
        mockPrisma
      );

      // Mock Vincent service failure
      mockVincentService.setPolicy.mockRejectedValue(new Error('Vincent sync failed'));

      // Attempt to set policy - should throw
      await expect(
        sellerAgent.setPolicyThresholds(50, 200)
      ).rejects.toThrow(/Vincent sync failed/i);

      // Database should not be updated if Vincent fails
      // (in real implementation, this depends on transaction ordering)
    });
  });

  describe('A2A Server Proof Validation', () => {
    test('rejects messages with missing proof for authenticated methods', async () => {
      const a2aServer = new A2AServer(mockVincentService as any);

      // Register a dummy handler for marketplace.offer
      a2aServer.registerHandler('marketplace.offer', async () => {
        return { success: true };
      });

      // Create message WITHOUT proof for authenticated method
      const message = {
        jsonrpc: '2.0' as const,
        method: 'marketplace.offer' as const,
        params: {
          listingId: 'listing-1',
          offerPrice: 10,
          agentId: 'buyer-agent-1',
        },
        id: 'req-1',
      };

      mockVincentService.verifyWalletOwnership.mockResolvedValue(false);

      const response = await a2aServer.handleMessage(message);

      // Should return UNAUTHORIZED error
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(response.error?.message).toMatch(/proof/i);
    });

    test('rejects messages with invalid proof signature', async () => {
      const a2aServer = new A2AServer(mockVincentService as any);

      a2aServer.registerHandler('marketplace.offer', async () => {
        return { success: true };
      });

      // Create message WITH proof but invalid signature
      const message = {
        jsonrpc: '2.0' as const,
        method: 'marketplace.offer' as const,
        params: {
          listingId: 'listing-1',
          offerPrice: 10,
          agentId: 'buyer-agent-1',
        },
        proof: {
          signature: '0xinvalidsignature',
          policyHash: '0xpolicyhash',
          pkpId: 'pkp_buyer1',
          timestamp: Date.now(),
        },
        id: 'req-2',
      };

      // Mock Vincent returns false for invalid signature
      mockVincentService.verifyWalletOwnership.mockResolvedValue(false);

      const response = await a2aServer.handleMessage(message);

      // Should return UNAUTHORIZED error
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(ErrorCodes.UNAUTHORIZED);
    });

    test('accepts messages with valid proof for authenticated methods', async () => {
      const a2aServer = new A2AServer(mockVincentService as any);

      let handlerCalled = false;
      a2aServer.registerHandler('marketplace.offer', async (params) => {
        handlerCalled = true;
        return { offerId: 'offer-123', accepted: true };
      });

      // Create message WITH valid proof
      const message = {
        jsonrpc: '2.0' as const,
        method: 'marketplace.offer' as const,
        params: {
          listingId: 'listing-1',
          offerPrice: 10,
          agentId: 'buyer-agent-1',
        },
        proof: {
          signature: '0xvalidsignature',
          policyHash: '0xpolicyhash',
          pkpId: 'pkp_buyer1',
          timestamp: Date.now(),
        },
        id: 'req-3',
      };

      // Mock Vincent returns true for valid signature
      mockVincentService.verifyWalletOwnership.mockResolvedValue(true);

      const response = await a2aServer.handleMessage(message);

      // Should succeed
      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({ offerId: 'offer-123', accepted: true });
      expect(handlerCalled).toBe(true);
    });

    test('rejects proof with expired timestamp', async () => {
      const a2aServer = new A2AServer(mockVincentService as any);

      a2aServer.registerHandler('marketplace.offer', async () => {
        return { success: true };
      });

      // Create message with old timestamp (15 minutes ago)
      const oldTimestamp = Date.now() - (15 * 60 * 1000);

      const message = {
        jsonrpc: '2.0' as const,
        method: 'marketplace.offer' as const,
        params: {
          listingId: 'listing-1',
          offerPrice: 10,
          agentId: 'buyer-agent-1',
        },
        proof: {
          signature: '0xvalidsignature',
          policyHash: '0xpolicyhash',
          pkpId: 'pkp_buyer1',
          timestamp: oldTimestamp, // Expired
        },
        id: 'req-4',
      };

      const response = await a2aServer.handleMessage(message);

      // Should return UNAUTHORIZED due to expired timestamp
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(ErrorCodes.UNAUTHORIZED);

      // Verify Vincent service was NOT called (rejected before verification)
      expect(mockVincentService.verifyWalletOwnership).not.toHaveBeenCalled();
    });

    test('allows unauthenticated methods without proof', async () => {
      const a2aServer = new A2AServer(mockVincentService as any);

      a2aServer.registerHandler('marketplace.search', async (params) => {
        return { results: [] };
      });

      // marketplace.search is NOT in AUTHENTICATED_METHODS
      const message = {
        jsonrpc: '2.0' as const,
        method: 'marketplace.search' as const,
        params: {
          query: 'laptop',
          maxResults: 10,
        },
        id: 'req-5',
      };

      const response = await a2aServer.handleMessage(message);

      // Should succeed without proof
      expect(response.error).toBeUndefined();
      expect(response.result).toEqual({ results: [] });

      // Vincent verification should NOT be called
      expect(mockVincentService.verifyWalletOwnership).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('handles missing agentId in authenticated request', async () => {
      const a2aServer = new A2AServer(mockVincentService as any);

      a2aServer.registerHandler('marketplace.offer', async () => {
        return { success: true };
      });

      // Message without agentId
      const message = {
        jsonrpc: '2.0' as const,
        method: 'marketplace.offer' as const,
        params: {
          listingId: 'listing-1',
          offerPrice: 10,
          // Missing agentId
        },
        proof: {
          signature: '0xsignature',
          policyHash: '0xpolicyhash',
          pkpId: 'pkp_1',
          timestamp: Date.now(),
        },
        id: 'req-6',
      };

      const response = await a2aServer.handleMessage(message);

      // Should return INVALID_PARAMS error
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(ErrorCodes.INVALID_PARAMS);
      expect(response.error?.message).toMatch(/agentId required/i);
    });

    test('BuyerAgent handles Prisma transaction rollback on error', async () => {
      const agentId = 'buyer-agent-rollback';
      const listingId = 'listing-error';

      const buyerAgent = new BuyerAgent(
        agentId,
        mockVincentService as any,
        mockA2AClient as any,
        mockNexusService as any,
        mockPrisma
      );

      mockVincentService.ensureWallet
        .mockResolvedValueOnce({
          pkpId: 'pkp_buyer',
          address: '0xbuyer',
          policies: DEFAULT_POLICY,
        })
        .mockResolvedValueOnce({
          pkpId: 'pkp_seller',
          address: '0xseller',
          policies: DEFAULT_POLICY,
        });

      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        type: 'BUYER',
        policies: DEFAULT_POLICY,
      });

      mockPrisma.listing.findUnique.mockResolvedValue({
        id: listingId,
        price: ethers.parseEther('5').toString(), // 5 ETH in wei
        status: 'AVAILABLE',
        sellerAgentId: 'seller-1',
      });

      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      // Mock signTypedData failure
      mockVincentService.signTypedData.mockRejectedValue(
        new Error('Signing failed')
      );

      // Attempt purchase - should fail and rollback
      await expect(buyerAgent.executePurchase(listingId)).rejects.toThrow(
        /Signing failed/i
      );

      // Transaction should NOT be created due to rollback
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });
  });
});
