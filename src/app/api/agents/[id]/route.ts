import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  logger.info({ agentId }, 'Fetching agent data');

  const prisma = getPrismaClient();

  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        listings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        sentTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const response = {
      agent: {
        id: agent.id,
        type: agent.type,
        walletAddress: agent.walletAddress,
        totalTransactions: agent.totalTransactions,
        successRate: agent.successRate,
        totalVolume: agent.totalVolume.toString(),
        lastActivity: agent.lastActivity,
        createdAt: agent.createdAt,
      },
      recentListings: agent.listings,
      recentTransactions: agent.sentTransactions,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    logger.error({ err: error, agentId }, 'Failed to fetch agent');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
