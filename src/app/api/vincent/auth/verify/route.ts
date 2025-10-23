/**
 * POST /api/vincent/auth/verify
 *
 * Verifies Vincent JWT and stores auth in database
 * Associates the PKP wallet with an agent for autonomous operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyVincentJWT } from '@/lib/vincent/jwt.service';
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

    const jwtAudience = process.env.NEXT_PUBLIC_APP_URL;
    if (!jwtAudience) {
      logger.error('NEXT_PUBLIC_APP_URL not configured');
      throw new Error('NEXT_PUBLIC_APP_URL not configured');
    }

    logger.info({ agentId: body.agentId }, 'Verifying Vincent JWT');

    // Verify JWT and extract PKP address
    // Throws if:
    // 1. JWT signature invalid
    // 2. Audience doesn't match
    // 3. JWT expired
    // 4. PKP address not found in expected fields
    const { decodedJWT, pkpAddress } = verifyVincentJWT(body.jwt, jwtAudience);

    logger.info(
      {
        pkpAddress,
        expiresAt: new Date(decodedJWT.exp * 1000),
        agentId: body.agentId,
      },
      'Vincent JWT verified successfully'
    );

    // Store or update auth in database
    const prisma = getPrismaClient();

    const vincentAuth = await prisma.vincentAuth.upsert({
      where: { userId: pkpAddress },
      update: {
        walletAddress: pkpAddress,
        authData: JSON.parse(JSON.stringify(decodedJWT)),
        expiresAt: new Date(decodedJWT.exp * 1000),
        issuedAt: new Date(),
        agentId: body.agentId || undefined,
      },
      create: {
        userId: pkpAddress,
        walletAddress: pkpAddress,
        authData: JSON.parse(JSON.stringify(decodedJWT)),
        expiresAt: new Date(decodedJWT.exp * 1000),
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
        walletAddress: pkpAddress,
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
