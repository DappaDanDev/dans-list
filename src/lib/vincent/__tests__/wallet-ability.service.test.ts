import { describe, test, expect, vi, beforeEach } from 'vitest';
import { VincentWalletAbilityService } from '../wallet-ability.service';
import { getPrismaClient } from '@/lib/database/prisma.service';

// Mock dependencies
vi.mock('@/lib/database/prisma.service', () => ({
  getPrismaClient: vi.fn(),
}));

vi.mock('../config', () => ({
  VINCENT_CONFIG: {
    appPrivateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    appId: '2353371285',
    appUrl: 'http://localhost:3000',
    chains: {
      ethereumSepolia: {
        chainId: 11155111,
        name: 'Ethereum Sepolia',
        rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/test',
        tokens: {
          pyusd: {
            address: '0x513421d7fb6A74AE51f3812826Aa2Db99a68F2C9',
            decimals: 6,
            symbol: 'PYUSD',
          },
          usdc: {
            address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
            decimals: 6,
            symbol: 'USDC',
          },
        },
        uniswapRouter: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
      },
      arbitrumSepolia: {
        chainId: 421614,
        name: 'Arbitrum Sepolia',
        rpcUrl: 'https://arb-sepolia.g.alchemy.com/v2/test',
        tokens: {
          pyusd: {
            address: '0xc6006A919685EA081697613373C50B6b46cd6F11',
            decimals: 6,
            symbol: 'PYUSD',
          },
          usdc: {
            address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
            decimals: 6,
            symbol: 'USDC',
          },
        },
      },
    },
  },
  validateVincentConfig: vi.fn(),
}));

vi.mock('@lit-protocol/lit-node-client', () => ({
  LitNodeClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ready: true,
  })),
}));

vi.mock('@lit-protocol/vincent-ability-uniswap-swap', () => ({
  getSignedUniswapQuote: vi.fn().mockResolvedValue({
    quote: {},
    signature: '0xmocksignature',
    dataSigned: '0xmockdata',
    signerPublicKey: '0xmockpubkey',
    signerEthAddress: '0x1234567890123456789012345678901234567890',
  }),
}));

vi.mock('../abilityClient', () => ({
  getUniswapSwapClient: vi.fn(() => ({
    precheck: vi.fn().mockResolvedValue({
      success: true,
      result: { valid: true },
    }),
    execute: vi.fn().mockResolvedValue({
      success: true,
      result: {
        amountOut: '95000000', // 95 USDC (6 decimals)
        swapTxHash: '0xswaptxhash123',
      },
    }),
  })),
}));

vi.mock('@/lib/utils/logger', () => ({
  loggers: {
    vincent: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

describe('VincentWalletAbilityService', () => {
  let service: VincentWalletAbilityService;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Prisma
    mockPrisma = {
      vincentAuth: {
        findFirst: vi.fn(),
      },
      proof: {
        create: vi.fn(),
      },
    };

    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma as any);

    service = new VincentWalletAbilityService();
  });

  describe('getWalletAddress', () => {
    test('returns PKP wallet address for valid agent', async () => {
      const mockAuth = {
        id: 'auth-1',
        userId: '0xuser123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        authData: {},
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        agentId: 'agent-1',
      };

      mockPrisma.vincentAuth.findFirst.mockResolvedValue(mockAuth);

      const walletAddress = await service.getWalletAddress('agent-1');

      expect(walletAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(mockPrisma.vincentAuth.findFirst).toHaveBeenCalledWith({
        where: { agentId: 'agent-1' },
      });
    });

    test('throws error if no auth found', async () => {
      mockPrisma.vincentAuth.findFirst.mockResolvedValue(null);

      await expect(service.getWalletAddress('agent-1')).rejects.toThrow(
        'No Vincent auth found for agent agent-1'
      );
    });

    test('throws error if auth expired', async () => {
      const mockAuth = {
        id: 'auth-1',
        userId: '0xuser123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        authData: {},
        issuedAt: new Date(Date.now() - 7200000), // 2 hours ago
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
        agentId: 'agent-1',
      };

      mockPrisma.vincentAuth.findFirst.mockResolvedValue(mockAuth);

      await expect(service.getWalletAddress('agent-1')).rejects.toThrow(
        'Vincent auth expired for agent agent-1'
      );
    });
  });

  describe('swapPyusdToUsdc', () => {
    test('successfully swaps PyUSD to USDC', async () => {
      const mockAuth = {
        id: 'auth-1',
        userId: '0xuser123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        authData: {},
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        agentId: 'agent-1',
      };

      mockPrisma.vincentAuth.findFirst.mockResolvedValue(mockAuth);
      mockPrisma.proof.create.mockResolvedValue({});

      const result = await service.swapPyusdToUsdc('agent-1', {
        chainId: 11155111,
        amountIn: 100, // 100 PYUSD
        slippageTolerance: 0.5,
      });

      expect(result).toEqual({
        amountOut: '95000000',
        swapTxHash: '0xswaptxhash123',
      });

      // Verify proof was created
      expect(mockPrisma.proof.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'AGENT_DECISION',
          hash: '0xswaptxhash123',
          agentId: 'agent-1',
          verified: true,
        }),
      });
    });

    test('throws error if swap precheck fails', async () => {
      const mockAuth = {
        id: 'auth-1',
        userId: '0xuser123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        authData: {},
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        agentId: 'agent-1',
      };

      mockPrisma.vincentAuth.findFirst.mockResolvedValue(mockAuth);

      // Mock failed precheck
      const { getUniswapSwapClient } = await import('../abilityClient');
      vi.mocked(getUniswapSwapClient).mockReturnValue({
        precheck: vi.fn().mockResolvedValue({
          success: false,
          result: { reason: 'Insufficient balance' },
        }),
        execute: vi.fn(),
      } as any);

      await expect(
        service.swapPyusdToUsdc('agent-1', {
          chainId: 11155111,
          amountIn: 100,
        })
      ).rejects.toThrow('Swap precheck failed');
    });

    test('throws error if swap execution fails', async () => {
      const mockAuth = {
        id: 'auth-1',
        userId: '0xuser123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        authData: {},
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        agentId: 'agent-1',
      };

      mockPrisma.vincentAuth.findFirst.mockResolvedValue(mockAuth);

      // Mock failed execution
      const { getUniswapSwapClient } = await import('../abilityClient');
      vi.mocked(getUniswapSwapClient).mockReturnValue({
        precheck: vi.fn().mockResolvedValue({
          success: true,
          result: {},
        }),
        execute: vi.fn().mockResolvedValue({
          success: false,
          result: { error: 'Swap failed on-chain' },
        }),
      } as any);

      await expect(
        service.swapPyusdToUsdc('agent-1', {
          chainId: 11155111,
          amountIn: 100,
        })
      ).rejects.toThrow('Swap failed');
    });
  });
});
