/**
 * POST /api/vincent/auth/verify
 *
 * Verifies Vincent JWT and stores auth in database
 * Associates the PKP wallet with an agent for autonomous operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

/**
 * Request body schema
 */
interface VerifyJWTRequest {
  jwt: string;
  agentId?: string; // Optional: Associate auth with existing agent
}

/**
 * Response schema
 */
interface VerifyJWTResponse {
  success: boolean;
  walletAddress?: string;
  agentId?: string;
  expiresAt?: string;
  error?: string;
}

/**
 * POST handler - Verify Vincent JWT and store auth
 */
export async function POST(req: NextRequest): Promise<NextResponse<VerifyJWTResponse>> {
  try {
    const body = (await req.json()) as VerifyJWTRequest;

    // Validate request body
    if (!body.jwt || typeof body.jwt !== 'string') {
      logger.warn('JWT verification request missing jwt field');
      return NextResponse.json(
        { success: false, error: 'JWT required' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      logger.error('NEXT_PUBLIC_APP_URL not configured');
      throw new Error('NEXT_PUBLIC_APP_URL not configured');
    }

    // JWT audience should be the callback URI (not just the app URL)
    const jwtAudience = `${appUrl}/vincent/callback`;

    logger.info({ agentId: body.agentId, jwtAudience }, 'Verifying Vincent JWT');

    // Decode JWT payload (already verified client-side via Vincent SDK)
    // Backend just needs to extract the wallet address and store in DB
    const jwtParts = body.jwt.split('.');
    if (jwtParts.length !== 3) {
      logger.error({ jwtLength: jwtParts.length }, 'Invalid JWT format - not 3 parts');
      throw new Error('Invalid JWT format');
    }

    let payload;
    try {
      const base64Payload = jwtParts[1];
      const decodedPayload = Buffer.from(base64Payload, 'base64').toString();
      payload = JSON.parse(decodedPayload);

      logger.info({
        payloadFields: payload ? Object.keys(payload) : [],
        hasPkpInfo: payload && 'pkpInfo' in payload,
        hasExp: payload && 'exp' in payload,
      }, 'Decoded JWT payload');
    } catch (parseError) {
      logger.error({
        err: parseError,
        jwtPart: jwtParts[1]?.substring(0, 50) + '...',
      }, 'Failed to parse JWT payload');
      throw new Error('Failed to parse JWT payload');
    }

    if (!payload || typeof payload !== 'object') {
      logger.error({ payload }, 'JWT payload is not a valid object');
      throw new Error('Invalid JWT payload');
    }

    // Extract PKP wallet address from payload
    const pkpAddress = payload.pkpInfo?.ethAddress;

    if (!pkpAddress || typeof pkpAddress !== 'string' || !pkpAddress.startsWith('0x')) {
      logger.error({
        payload,
        pkpAddress,
      }, 'Could not extract PKP address from JWT');
      throw new Error('PKP address not found in JWT');
    }

    // Validate expiration timestamp
    if (!payload.exp || typeof payload.exp !== 'number') {
      logger.error({
        exp: payload.exp,
        expType: typeof payload.exp,
      }, 'JWT missing or invalid expiration timestamp');
      throw new Error('JWT missing expiration timestamp');
    }

    const normalizedAddress = pkpAddress.toLowerCase();

    logger.info({
      pkpAddress: normalizedAddress,
      pkpTokenId: payload.pkpInfo?.tokenId,
      exp: new Date(payload.exp * 1000),
    }, 'Extracted PKP info from JWT');

    // Store or update auth in database
    const prisma = getPrismaClient();

    const vincentAuth = await prisma.vincentAuth.upsert({
      where: { userId: normalizedAddress },
      update: {
        walletAddress: normalizedAddress,
        authData: payload,
        expiresAt: new Date(payload.exp * 1000),
        issuedAt: new Date(),
        agentId: body.agentId || undefined,
      },
      create: {
        userId: normalizedAddress,
        walletAddress: normalizedAddress,
        authData: payload,
        expiresAt: new Date(payload.exp * 1000),
        issuedAt: new Date(),
        agentId: body.agentId || undefined,
      },
    });

    logger.info(
      {
        pkpAddress,
        agentId: vincentAuth.agentId,
      },
      'Vincent auth stored successfully'
    );

    return NextResponse.json(
      {
        success: true,
        walletAddress: normalizedAddress,
        agentId: vincentAuth.agentId || undefined,
        expiresAt: vincentAuth.expiresAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ err: error }, 'JWT verification failed');

    // Determine appropriate status code
    const status = error instanceof Error && error.message.includes('expired') ? 401 : 400;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'JWT verification failed',
      },
      { status }
    );
  }
}
