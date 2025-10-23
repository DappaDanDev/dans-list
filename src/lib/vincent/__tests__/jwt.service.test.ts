import { describe, test, expect, vi, beforeEach } from 'vitest';
import { extractPkpAddress, verifyVincentJWT, isJwtExpired } from '../jwt.service';
import type { DecodedJWT } from '@lit-protocol/vincent-app-sdk/jwt';

// Mock the Vincent SDK
vi.mock('@lit-protocol/vincent-app-sdk/jwt', () => ({
  verify: vi.fn(),
}));

// Mock the logger
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

describe('JWT Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractPkpAddress', () => {
    test('extracts PKP address from sub field', () => {
      const decodedJWT: DecodedJWT = {
        sub: '0x1234567890123456789012345678901234567890',
        aud: 'http://localhost:3000',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        iss: 'vincent',
      };

      const address = extractPkpAddress(decodedJWT);
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    test('extracts PKP address from pkpEthAddress field', () => {
      const decodedJWT = {
        sub: 'some-other-value',
        pkpEthAddress: '0xABCDEF1234567890123456789012345678901234',
        aud: 'http://localhost:3000',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        iss: 'vincent',
      } as any;

      const address = extractPkpAddress(decodedJWT);
      expect(address).toBe('0xabcdef1234567890123456789012345678901234');
    });

    test('extracts PKP address from walletAddress field', () => {
      const decodedJWT = {
        sub: 'some-other-value',
        walletAddress: '0xFEDCBA0987654321098765432109876543210987',
        aud: 'http://localhost:3000',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        iss: 'vincent',
      } as any;

      const address = extractPkpAddress(decodedJWT);
      expect(address).toBe('0xfedcba0987654321098765432109876543210987');
    });

    test('extracts PKP address from address field', () => {
      const decodedJWT = {
        sub: 'some-other-value',
        address: '0x1111111111111111111111111111111111111111',
        aud: 'http://localhost:3000',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        iss: 'vincent',
      } as any;

      const address = extractPkpAddress(decodedJWT);
      expect(address).toBe('0x1111111111111111111111111111111111111111');
    });

    test('throws error if no valid address found', () => {
      const decodedJWT: DecodedJWT = {
        sub: 'not-an-address',
        aud: 'http://localhost:3000',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        iss: 'vincent',
      };

      expect(() => extractPkpAddress(decodedJWT)).toThrow(
        'PKP wallet address not found in JWT'
      );
    });

    test('prioritizes sub field over other fields', () => {
      const decodedJWT = {
        sub: '0x1234567890123456789012345678901234567890',
        pkpEthAddress: '0xABCDEF1234567890123456789012345678901234',
        walletAddress: '0xFEDCBA0987654321098765432109876543210987',
        address: '0x1111111111111111111111111111111111111111',
        aud: 'http://localhost:3000',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        iss: 'vincent',
      } as any;

      const address = extractPkpAddress(decodedJWT);
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });
  });

  describe('verifyVincentJWT', () => {
    test('verifies JWT and extracts PKP address', async () => {
      const { verify } = await import('@lit-protocol/vincent-app-sdk/jwt');
      const mockVerify = vi.mocked(verify);

      const mockDecodedJWT: DecodedJWT = {
        sub: '0x1234567890123456789012345678901234567890',
        aud: 'http://localhost:3000',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        iss: 'vincent',
      };

      mockVerify.mockReturnValue(mockDecodedJWT);

      const result = verifyVincentJWT('mock-jwt-string', 'http://localhost:3000');

      expect(result.decodedJWT).toEqual(mockDecodedJWT);
      expect(result.pkpAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(mockVerify).toHaveBeenCalledWith('mock-jwt-string', 'http://localhost:3000');
    });

    test('throws error from verify if JWT invalid', async () => {
      const { verify } = await import('@lit-protocol/vincent-app-sdk/jwt');
      const mockVerify = vi.mocked(verify);

      mockVerify.mockImplementation(() => {
        throw new Error('Invalid JWT signature');
      });

      expect(() =>
        verifyVincentJWT('invalid-jwt', 'http://localhost:3000')
      ).toThrow('Invalid JWT signature');
    });

    test('throws error if PKP address not found', async () => {
      const { verify } = await import('@lit-protocol/vincent-app-sdk/jwt');
      const mockVerify = vi.mocked(verify);

      const mockDecodedJWT: DecodedJWT = {
        sub: 'not-an-address',
        aud: 'http://localhost:3000',
        exp: Date.now() / 1000 + 3600,
        iat: Date.now() / 1000,
        iss: 'vincent',
      };

      mockVerify.mockReturnValue(mockDecodedJWT);

      expect(() =>
        verifyVincentJWT('mock-jwt-string', 'http://localhost:3000')
      ).toThrow('PKP wallet address not found in JWT');
    });
  });

  describe('isJwtExpired', () => {
    test('returns false for unexpired JWT', () => {
      const decodedJWT: DecodedJWT = {
        sub: 'test',
        aud: 'http://localhost:3000',
        exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
        iat: Math.floor(Date.now() / 1000),
        iss: 'vincent',
      };

      expect(isJwtExpired(decodedJWT)).toBe(false);
    });

    test('returns true for expired JWT', () => {
      const decodedJWT: DecodedJWT = {
        sub: 'test',
        aud: 'http://localhost:3000',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
        iss: 'vincent',
      };

      expect(isJwtExpired(decodedJWT)).toBe(true);
    });

    test('returns true for JWT expiring at current time', () => {
      const decodedJWT: DecodedJWT = {
        sub: 'test',
        aud: 'http://localhost:3000',
        exp: Math.floor(Date.now() / 1000), // Expires now
        iat: Math.floor(Date.now() / 1000) - 3600,
        iss: 'vincent',
      };

      expect(isJwtExpired(decodedJWT)).toBe(true);
    });
  });
});
