import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NexusService, getNexusService } from '../service';
import type { NexusTransactionParams } from '../service';

// Mock dependencies
vi.mock('@avail-project/nexus', () => {
  const mockNexusEvents = {
    on: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  return {
    NexusSDK: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      transfer: vi.fn().mockResolvedValue({
        success: true,
        explorerUrl: 'https://sepolia.etherscan.io/tx/0xabc123',
      }),
      simulateTransfer: vi.fn().mockResolvedValue({
        intent: {},
        token: {},
      }),
      setOnIntentHook: vi.fn(),
      setOnAllowanceHook: vi.fn(),
      deinit: vi.fn().mockResolvedValue(undefined),
      nexusEvents: mockNexusEvents,
    })),
  };
});

vi.mock('@/lib/vincent/provider-ability', () => ({
  VincentProviderAbility: vi.fn().mockImplementation(() => ({
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  })),
}));

vi.mock('@/lib/vincent/wallet-ability.service', () => ({
  VincentWalletAbilityService: vi.fn().mockImplementation(() => ({
    getWalletAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/lib/utils/logger', () => ({
  loggers: {
    nexus: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

describe('NexusService', () => {
  let service: NexusService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NexusService({ network: 'testnet' });
  });

  describe('executeTransfer', () => {
    test('successfully executes cross-chain USDC transfer', async () => {
      const params: NexusTransactionParams = {
        fromAgentId: 'agent-1',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614, // Arbitrum Sepolia
      };

      const result = await service.executeTransfer(params);

      expect(result.status).toBe('SUCCESS');
      expect(result.explorerUrl).toBe('https://sepolia.etherscan.io/tx/0xabc123');
      expect(result.error).toBeUndefined();
    });

    test('handles transfer failure gracefully', async () => {
      const { NexusSDK } = await import('@avail-project/nexus');
      const mockNexusSDK = vi.mocked(NexusSDK);

      // Mock failure
      mockNexusSDK.mockImplementationOnce(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        transfer: vi.fn().mockResolvedValue({
          success: false,
          error: 'Insufficient balance',
        }),
        simulateTransfer: vi.fn(),
        setOnIntentHook: vi.fn(),
        setOnAllowanceHook: vi.fn(),
        deinit: vi.fn(),
        nexusEvents: {
          on: vi.fn(),
          emit: vi.fn(),
          removeAllListeners: vi.fn(),
        },
      })) as any;

      // Create new service instance with mocked SDK
      const newService = new NexusService({ network: 'testnet' });

      const params: NexusTransactionParams = {
        fromAgentId: 'agent-2',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614,
      };

      const result = await newService.executeTransfer(params);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Insufficient balance');
    });

    test('caches SDK instance for same agent', async () => {
      const params: NexusTransactionParams = {
        fromAgentId: 'agent-1',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614,
      };

      // First call
      await service.executeTransfer(params);

      // Second call with same agent
      await service.executeTransfer(params);

      const { VincentWalletAbilityService } = await import(
        '@/lib/vincent/wallet-ability.service'
      );
      const mockWalletService = vi.mocked(VincentWalletAbilityService);

      // getWalletAddress should only be called once due to caching
      expect(mockWalletService.mock.results[0].value.getWalletAddress).toHaveBeenCalledTimes(
        1
      );
    });

    test('sets up hooks correctly', async () => {
      const { NexusSDK } = await import('@avail-project/nexus');

      const params: NexusTransactionParams = {
        fromAgentId: 'agent-1',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614,
      };

      await service.executeTransfer(params);

      // Verify hooks were set
      const mockInstance = vi.mocked(NexusSDK).mock.results[0].value;
      expect(mockInstance.setOnIntentHook).toHaveBeenCalled();
      expect(mockInstance.setOnAllowanceHook).toHaveBeenCalled();
    });

    test('sets up event listeners correctly', async () => {
      const { NexusSDK } = await import('@avail-project/nexus');

      const params: NexusTransactionParams = {
        fromAgentId: 'agent-1',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614,
      };

      await service.executeTransfer(params);

      // Verify event listeners were set
      const mockInstance = vi.mocked(NexusSDK).mock.results[0].value;
      expect(mockInstance.nexusEvents.on).toHaveBeenCalledWith(
        'step_complete',
        expect.any(Function)
      );
      expect(mockInstance.nexusEvents.on).toHaveBeenCalledWith(
        'expected_steps',
        expect.any(Function)
      );
      expect(mockInstance.nexusEvents.on).toHaveBeenCalledWith(
        'bridge_execute_expected_steps',
        expect.any(Function)
      );
      expect(mockInstance.nexusEvents.on).toHaveBeenCalledWith(
        'bridge_execute_completed_steps',
        expect.any(Function)
      );
    });

    test('auto-approves intents via hook', async () => {
      const { NexusSDK } = await import('@avail-project/nexus');

      const params: NexusTransactionParams = {
        fromAgentId: 'agent-1',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614,
      };

      await service.executeTransfer(params);

      // Get the intent hook callback
      const mockInstance = vi.mocked(NexusSDK).mock.results[0].value;
      const intentHookCallback = vi.mocked(mockInstance.setOnIntentHook).mock
        .calls[0][0];

      // Simulate intent hook being called
      const mockAllow = vi.fn();
      const mockDeny = vi.fn();
      intentHookCallback({
        intent: { id: 'intent-1', status: 'pending' } as any,
        allow: mockAllow,
        deny: mockDeny,
        refresh: vi.fn(),
      });

      // Verify auto-approval
      expect(mockAllow).toHaveBeenCalled();
      expect(mockDeny).not.toHaveBeenCalled();
    });

    test('auto-approves allowances with min amount via hook', async () => {
      const { NexusSDK } = await import('@avail-project/nexus');

      const params: NexusTransactionParams = {
        fromAgentId: 'agent-1',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614,
      };

      await service.executeTransfer(params);

      // Get the allowance hook callback
      const mockInstance = vi.mocked(NexusSDK).mock.results[0].value;
      const allowanceHookCallback = vi.mocked(mockInstance.setOnAllowanceHook)
        .mock.calls[0][0];

      // Simulate allowance hook being called
      const mockAllow = vi.fn();
      const mockDeny = vi.fn();
      allowanceHookCallback({
        allow: mockAllow,
        deny: mockDeny,
        sources: [],
      });

      // Verify auto-approval with 'min'
      expect(mockAllow).toHaveBeenCalledWith(['min']);
      expect(mockDeny).not.toHaveBeenCalled();
    });
  });

  describe('simulateTransfer', () => {
    test('successfully simulates transfer', async () => {
      const params: NexusTransactionParams = {
        fromAgentId: 'agent-1',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614,
      };

      const result = await service.simulateTransfer(params);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('handles simulation errors', async () => {
      const { NexusSDK } = await import('@avail-project/nexus');
      const mockNexusSDK = vi.mocked(NexusSDK);

      // Mock failure
      mockNexusSDK.mockImplementationOnce(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        transfer: vi.fn(),
        simulateTransfer: vi.fn().mockRejectedValue(new Error('Simulation failed')),
        setOnIntentHook: vi.fn(),
        setOnAllowanceHook: vi.fn(),
        deinit: vi.fn(),
        nexusEvents: {
          on: vi.fn(),
          emit: vi.fn(),
          removeAllListeners: vi.fn(),
        },
      })) as any;

      const newService = new NexusService({ network: 'testnet' });

      const params: NexusTransactionParams = {
        fromAgentId: 'agent-3',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614,
      };

      const result = await newService.simulateTransfer(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Simulation failed');
    });
  });

  describe('clearCache', () => {
    test('clears SDK cache and deinitializes SDKs', async () => {
      const { NexusSDK } = await import('@avail-project/nexus');

      const params: NexusTransactionParams = {
        fromAgentId: 'agent-1',
        toAddress: '0xrecipient123',
        amount: '100',
        token: 'USDC',
        destinationChainId: 421614,
      };

      // Create SDK instance
      await service.executeTransfer(params);

      // Clear cache
      service.clearCache();

      // Verify deinit was called
      const mockInstance = vi.mocked(NexusSDK).mock.results[0].value;
      expect(mockInstance.deinit).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    test('cleans up service and disconnects wallet service', async () => {
      const { VincentWalletAbilityService } = await import(
        '@/lib/vincent/wallet-ability.service'
      );

      await service.cleanup();

      // Verify wallet service disconnect was called
      const mockWalletService = vi.mocked(VincentWalletAbilityService).mock
        .results[0].value;
      expect(mockWalletService.disconnect).toHaveBeenCalled();
    });
  });

  describe('getNexusService', () => {
    test('returns singleton instance', () => {
      const service1 = getNexusService();
      const service2 = getNexusService();

      expect(service1).toBe(service2);
    });

    test('uses testnet by default', () => {
      const service = getNexusService();
      expect(service).toBeDefined();
    });
  });
});
