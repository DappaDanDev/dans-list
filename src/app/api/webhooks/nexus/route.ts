/**
 * Nexus Webhook Handler
 * Receives transaction status updates from Avail Nexus
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.nexus;

/**
 * Nexus webhook payload
 */
interface NexusWebhookPayload {
  nexusId: string;
  transactionHash: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  sourceChain: number;
  destinationChain: number;
  timestamp: number;
  error?: string;
}

/**
 * POST /api/webhooks/nexus
 * Handle Nexus transaction status updates
 */
export async function POST(request: NextRequest) {
  try {
    // Parse webhook payload
    const payload: NexusWebhookPayload = await request.json();

    logger.info({
      nexusId: payload.nexusId,
      transactionHash: payload.transactionHash,
      status: payload.status,
    }, 'Received Nexus webhook');

    // TODO: Verify webhook signature for security
    // const signature = request.headers.get('x-nexus-signature');
    // if (!verifyNexusSignature(payload, signature)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    // Find transaction by Nexus ID or hash
    const prisma = getPrismaClient();
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { hash: payload.transactionHash },
          { hash: { contains: payload.nexusId } }, // Search in hash field
        ],
      },
    });

    if (!transaction) {
      logger.warn({
        nexusId: payload.nexusId,
        transactionHash: payload.transactionHash,
      }, 'Transaction not found for Nexus webhook');

      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Update transaction status
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: payload.status,
        hash: payload.transactionHash, // Update with final hash
        updatedAt: new Date(),
      },
    });

    logger.info({
      transactionId: transaction.id,
      oldStatus: transaction.status,
      newStatus: payload.status,
      transactionHash: payload.transactionHash,
    }, 'Transaction status updated from Nexus webhook');

    // If transaction is confirmed, update listing status
    if (payload.status === 'CONFIRMED' && transaction.listingId) {
      await prisma.listing.update({
        where: { id: transaction.listingId },
        data: { status: 'SOLD' },
      });

      logger.info({
        listingId: transaction.listingId,
        transactionId: transaction.id,
      }, 'Listing marked as SOLD');
    }

    // If transaction failed, mark listing as available again
    if (payload.status === 'FAILED' && transaction.listingId) {
      await prisma.listing.update({
        where: { id: transaction.listingId },
        data: { status: 'AVAILABLE' },
      });

      logger.warn({
        listingId: transaction.listingId,
        transactionId: transaction.id,
        error: payload.error,
      }, 'Transaction failed, listing marked as AVAILABLE');
    }

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      status: payload.status,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error processing Nexus webhook');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/nexus
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    service: 'nexus-webhook',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
