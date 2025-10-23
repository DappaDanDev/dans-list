import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../agent.service';
import type { PurchaseParams } from '../agent.service';

// Mock dependencies
vi.mock('@/lib/vincent/wallet-ability.service', () => ({
  VincentWalletAbilityService: vi.fn().mockImplementation(() => ({
    getWalletAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    swapPyusdToUsdc: vi.fn().mockResolvedValue({
      amountOut: '95000000', // 95 USDC (6 decimals)
      swapTxHash: '0xswap123',
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/lib/nexus/service', () => ({
  NexusService: vi.fn().mockImplementation(() => ({
    executeTransfer: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      explorerUrl: 'https://arbiscan.io/tx/0xtransfer123',
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Create shared mock Prisma client
const mockPrismaClient = {
  transaction: {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue({
      hash: '0xswap123',
      fromAgentId: 'agent-1',
      listingId: 'listing-1',
      amount: BigInt(95000000),
      token: 'USDC',
      sourceChain: 11155111,
      destinationChain: 421614,
      status: 'PENDING',
      fromAgent: {},
      toAgent: null,
      listing: {},
    }),
  },
  proof: {
    create: vi.fn().mockResolvedValue({}),
  },
};

vi.mock('@/lib/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => mockPrismaClient),
}));

vi.mock('@/lib/utils/logger', () => ({
  loggers: {
    agents: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentService();
  });

  describe('executePurchase', () => {
    test('successfully executes complete purchase flow', async () => {
      const params: PurchaseParams = {
        buyerAgentId: 'agent-1',
        sellerWalletAddress: '0xseller123',
        pyusdAmount: 100,
        fromChainId: 11155111, // ETH Sepolia
        toChainId: 421614, // Arbitrum Sepolia
        listingId: 'listing-1',
      };

      const result = await service.executePurchase(params);

      expect(result.success).toBe(true);
      expect(result.swapTxHash).toBe('0xswap123');
      expect(result.transferExplorerUrl).toBe('https://arbiscan.io/tx/0xtransfer123');
      expect(result.usdcAmount).toBe('95000000');
      expect(result.error).toBeUndefined();
    });

    test('calls wallet service to get buyer wallet address', async () => {
      const { VincentWalletAbilityService } = await import(
        '@/lib/vincent/wallet-ability.service'
      );

      const params: PurchaseParams = {
        buyerAgentId: 'agent-1',
        sellerWalletAddress: '0xseller123',
        pyusdAmount: 100,
        fromChainId: 11155111,
        toChainId: 421614,
        listingId: 'listing-1',
      };

      await service.executePurchase(params);

      const mockWalletService = vi.mocked(VincentWalletAbilityService).mock.results[0]
        .value;
      expect(mockWalletService.getWalletAddress).toHaveBeenCalledWith('agent-1');
    });

    test('calls wallet service to swap PyUSD to USDC', async () => {
      const { VincentWalletAbilityService } = await import(
        '@/lib/vincent/wallet-ability.service'
      );

      const params: PurchaseParams = {
        buyerAgentId: 'agent-1',
        sellerWalletAddress: '0xseller123',
        pyusdAmount: 100,
        fromChainId: 11155111,
        toChainId: 421614,
        listingId: 'listing-1',
      };

      await service.executePurchase(params);

      const mockWalletService = vi.mocked(VincentWalletAbilityService).mock.results[0]
        .value;
      expect(mockWalletService.swapPyusdToUsdc).toHaveBeenCalledWith('agent-1', {
        chainId: 11155111,
        amountIn: 100,
        slippageTolerance: 0.5,
      });
    });

    test('calls nexus service to execute cross-chain transfer', async () => {
      const { NexusService } = await import('@/lib/nexus/service');

      const params: PurchaseParams = {
        buyerAgentId: 'agent-1',
        sellerWalletAddress: '0xseller123',
        pyusdAmount: 100,
        fromChainId: 11155111,
        toChainId: 421614,
        listingId: 'listing-1',
      };

      await service.executePurchase(params);

      const mockNexusService = vi.mocked(NexusService).mock.results[0].value;
      expect(mockNexusService.executeTransfer).toHaveBeenCalledWith({
        fromAgentId: 'agent-1',
        toAddress: '0xseller123',
        amount: '95', // 95000000 / 1e6 = 95 USDC
        token: 'USDC',
        destinationChainId: 421614,
      });
    });

    test('records transaction in database', async () => {
      const params: PurchaseParams = {
        buyerAgentId: 'agent-1',
        sellerWalletAddress: '0xseller123',
        pyusdAmount: 100,
        fromChainId: 11155111,
        toChainId: 421614,
        listingId: 'listing-1',
      };

      await service.executePurchase(params);

      expect(mockPrismaClient.transaction.create).toHaveBeenCalledWith({
        data: {
          hash: '0xswap123',
          fromAgentId: 'agent-1',
          listingId: 'listing-1',
          amount: BigInt(95000000),
          token: 'USDC',
          sourceChain: 11155111,
          destinationChain: 421614,
          status: 'PENDING',
        },
      });
    });

    test('handles swap failure', async () => {
      const { VincentWalletAbilityService } = await import(
        '@/lib/vincent/wallet-ability.service'
      );
      const mockWalletService = vi.mocked(VincentWalletAbilityService);

      // Mock swap failure
      mockWalletService.mockImplementationOnce(() => ({
        getWalletAddress: vi.fn().mockResolvedValue('0x1234'),
        swapPyusdToUsdc: vi.fn().mockRejectedValue(new Error('Insufficient balance')),
        disconnect: vi.fn(),
      })) as any;

      const newService = new AgentService();

      const params: PurchaseParams = {
        buyerAgentId: 'agent-2',
        sellerWalletAddress: '0xseller123',
        pyusdAmount: 100,
        fromChainId: 11155111,
        toChainId: 421614,
        listingId: 'listing-1',
      };

      const result = await newService.executePurchase(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient balance');
    });

    test('handles transfer failure', async () => {
      const { NexusService } = await import('@/lib/nexus/service');
      const mockNexusService = vi.mocked(NexusService);

      // Mock transfer failure
      mockNexusService.mockImplementationOnce(() => ({
        executeTransfer: vi.fn().mockResolvedValue({
          status: 'FAILED',
          error: 'Insufficient liquidity',
        }),
        cleanup: vi.fn(),
      })) as any;

      const newService = new AgentService();

      const params: PurchaseParams = {
        buyerAgentId: 'agent-3',
        sellerWalletAddress: '0xseller123',
        pyusdAmount: 100,
        fromChainId: 11155111,
        toChainId: 421614,
        listingId: 'listing-1',
      };

      const result = await newService.executePurchase(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient liquidity');
    });

    test('stores proof on failure', async () => {
      const { VincentWalletAbilityService } = await import(
        '@/lib/vincent/wallet-ability.service'
      );
      const mockWalletService = vi.mocked(VincentWalletAbilityService);

      // Mock failure
      mockWalletService.mockImplementationOnce(() => ({
        getWalletAddress: vi.fn().mockResolvedValue('0x1234'),
        swapPyusdToUsdc: vi.fn().mockRejectedValue(new Error('Test error')),
        disconnect: vi.fn(),
      })) as any;

      const newService = new AgentService();

      const params: PurchaseParams = {
        buyerAgentId: 'agent-4',
        sellerWalletAddress: '0xseller123',
        pyusdAmount: 100,
        fromChainId: 11155111,
        toChainId: 421614,
        listingId: 'listing-1',
      };

      await newService.executePurchase(params);

      expect(mockPrismaClient.proof.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'AGENT_DECISION',
          agentId: 'agent-4',
          verified: false,
        }),
      });
    });
  });

  describe('getPurchaseStatus', () => {
    test('returns transaction status', async () => {
      const status = await service.getPurchaseStatus('0xswap123');

      expect(status.transaction).toBeDefined();
      expect(status.transaction.hash).toBe('0xswap123');
      expect(status.status).toBe('PENDING');
    });

    test('throws error if transaction not found', async () => {
      // Mock findUnique to return null for this test
      vi.mocked(mockPrismaClient.transaction.findUnique).mockResolvedValueOnce(null);

      await expect(service.getPurchaseStatus('0xnonexistent')).rejects.toThrow(
        'Transaction not found: 0xnonexistent'
      );
    });
  });

  describe('cleanup', () => {
    test('cleans up wallet and nexus services', async () => {
      const { VincentWalletAbilityService } = await import(
        '@/lib/vincent/wallet-ability.service'
      );
      const { NexusService } = await import('@/lib/nexus/service');

      await service.cleanup();

      const mockWalletService = vi.mocked(VincentWalletAbilityService).mock.results[0]
        .value;
      const mockNexusService = vi.mocked(NexusService).mock.results[0].value;

      expect(mockWalletService.disconnect).toHaveBeenCalled();
      expect(mockNexusService.cleanup).toHaveBeenCalled();
    });
  });
});
