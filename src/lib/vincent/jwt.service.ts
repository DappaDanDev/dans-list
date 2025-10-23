import { verify, type DecodedJWT } from '@lit-protocol/vincent-app-sdk/jwt';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;

/**
 * JWT Verification Service
 *
 * IMPORTANT: JWT field verification needed!
 *
 * According to Vincent docs, JWT contains user's PKP wallet address.
 * The exact field name needs verification:
 * - Standard: decodedJWT.sub (JWT subject claim)
 * - Custom: decodedJWT.pkpEthAddress or decodedJWT.walletAddress
 *
 * Action items:
 * 1. Test actual Vincent authorization flow
 * 2. Inspect JWT structure from real authorization
 * 3. Update extractPkpAddress() with correct field
 *
 * Reference: Vincent SDK JWT docs
 * https://github.com/LIT-Protocol/vincent-app-sdk/tree/main/packages/jwt
 */

/**
 * Extract PKP wallet address from Vincent JWT
 *
 * Uses defensive strategy: tries multiple possible fields
 * until actual JWT structure is verified
 *
 * @param decodedJWT - Decoded JWT from Vincent
 * @returns PKP wallet address (lowercase)
 * @throws Error if address not found in expected fields
 */
export function extractPkpAddress(decodedJWT: DecodedJWT): string {
  // Strategy 1: Check sub field (standard JWT claim)
  if (decodedJWT.sub && decodedJWT.sub.startsWith('0x')) {
    logger.info('Found PKP address in decodedJWT.sub');
    return decodedJWT.sub.toLowerCase();
  }

  // Strategy 2: Check pkpEthAddress field (potential custom claim)
  if ('pkpEthAddress' in decodedJWT) {
    const pkpAddress = (decodedJWT as any).pkpEthAddress;
    if (pkpAddress && typeof pkpAddress === 'string' && pkpAddress.startsWith('0x')) {
      logger.info('Found PKP address in decodedJWT.pkpEthAddress');
      return pkpAddress.toLowerCase();
    }
  }

  // Strategy 3: Check walletAddress field
  if ('walletAddress' in decodedJWT) {
    const walletAddress = (decodedJWT as any).walletAddress;
    if (walletAddress && typeof walletAddress === 'string' && walletAddress.startsWith('0x')) {
      logger.info('Found PKP address in decodedJWT.walletAddress');
      return walletAddress.toLowerCase();
    }
  }

  // Strategy 4: Check address field
  if ('address' in decodedJWT) {
    const address = (decodedJWT as any).address;
    if (address && typeof address === 'string' && address.startsWith('0x')) {
      logger.info('Found PKP address in decodedJWT.address');
      return address.toLowerCase();
    }
  }

  // If none found, log full JWT structure for debugging
  logger.error(
    {
      jwtFields: Object.keys(decodedJWT),
      subValue: decodedJWT.sub,
      subType: typeof decodedJWT.sub,
    },
    'Could not extract PKP address from JWT - unexpected structure'
  );

  throw new Error(
    'PKP wallet address not found in JWT. ' +
      'Checked fields: sub, pkpEthAddress, walletAddress, address. ' +
      'Please verify Vincent JWT structure and update extractPkpAddress()'
  );
}

/**
 * Verify JWT signature and extract PKP address
 *
 * @param jwtString - Raw JWT string from Vincent authorization
 * @param audience - Expected JWT audience (app URL)
 * @returns Decoded JWT and PKP address
 * @throws Error if JWT invalid or PKP address not found
 */
export function verifyVincentJWT(
  jwtString: string,
  audience: string
): {
  decodedJWT: DecodedJWT;
  pkpAddress: string;
} {
  // Verify JWT signature and audience
  // Throws if signature invalid, expired, or audience mismatch
  const decodedJWT = verify(jwtString, audience);

  // Extract PKP address (will throw if not found)
  const pkpAddress = extractPkpAddress(decodedJWT);

  return { decodedJWT, pkpAddress };
}

/**
 * Check if JWT is expired
 *
 * @param decodedJWT - Decoded JWT
 * @returns true if expired
 */
export function isJwtExpired(decodedJWT: DecodedJWT): boolean {
  return Date.now() >= decodedJWT.exp * 1000;
}
