/**
 * GET /api/metrics/summary
 *
 * Fetch marketplace summary metrics
 */

import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

/**
 * Response schema
 */
interface MetricsSummaryResponse {
  totalListings: number;
  activeListings: number;
  totalVolume: string;
  volume24h: string;
  activeAgents: number;
  totalAgents: number;
  totalTransactions: number;
  avgTransactionTime: number;
}

/**
 * GET handler - Fetch metrics summary
 */
export async function GET(): Promise<NextResponse<MetricsSummaryResponse | { error: string }>> {
  try {
    const prisma = getPrismaClient();

    // Calculate time windows
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch metrics in parallel
    const [
      totalListings,
      activeListings,
      totalVolumeResult,
      volume24hResult,
      activeAgents,
      totalAgents,
      totalTransactions,
    ] = await Promise.all([
      // Total listings (all time)
      prisma.listing.count(),

      // Active listings
      prisma.listing.count({
        where: { status: 'AVAILABLE' },
      }),

      // Total volume (all confirmed transactions)
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: 'CONFIRMED' },
      }),

      // 24h volume
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          status: 'CONFIRMED',
          createdAt: { gte: oneDayAgo },
        },
      }),

      // Active agents (with activity in last 24h)
      prisma.agent.count({
        where: {
          lastActivity: { gte: oneDayAgo },
        },
      }),

      // Total agents
      prisma.agent.count(),

      // Total transactions
      prisma.transaction.count(),
    ]);

    // Calculate total volume in USDC (6 decimals)
    const totalVolume = totalVolumeResult._sum.amount
      ? (Number(totalVolumeResult._sum.amount) / 1e6).toFixed(2)
      : '0.00';

    const volume24h = volume24hResult._sum.amount
      ? (Number(volume24hResult._sum.amount) / 1e6).toFixed(2)
      : '0.00';

    // Calculate average transaction time (placeholder - would need transaction timestamps)
    // For now, we'll use a reasonable default
    const avgTransactionTime = 2.3; // minutes

    const response: MetricsSummaryResponse = {
      totalListings,
      activeListings,
      totalVolume,
      volume24h,
      activeAgents,
      totalAgents,
      totalTransactions,
      avgTransactionTime,
    };

    // Log before returning to avoid worker exit race condition
    try {
      logger.info(
        {
          totalListings,
          activeListings,
          totalVolume,
          activeAgents,
        },
        'Metrics summary fetched successfully'
      );
    } catch (error) {
      // Ignore logging errors to prevent worker crashes
      console.error('Logger error:', error);
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch metrics summary');

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
