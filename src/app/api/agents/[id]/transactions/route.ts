/**
 * Transaction History API Route
 * Returns transaction history for a given agent
 *
 * GET /api/agents/[id]/transactions
 * The id parameter accepts wallet address (0x...) or database ID
 * Query params:
 *   - limit: number (default: 50, max: 100)
 *   - offset: number (default: 0)
 *   - status: TransactionStatus filter (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';
import { TransactionStatus } from '@prisma/client';

const logger = loggers.api;

interface TransactionHistoryParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/agents/[id]/transactions
 * Returns paginated transaction history for an agent
 * The id can be either wallet address or database ID
 */
export async function GET(
  request: NextRequest,
  { params }: TransactionHistoryParams
) {
  try {
    const { id } = await params;
    const agentId = id;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50'),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0');
    const statusFilter = searchParams.get('status') as TransactionStatus | null;

    logger.info({ agentId, limit, offset, statusFilter }, 'Fetching transaction history');

    const prisma = getPrismaClient();

    // Find agent by wallet address
    const agent = await prisma.agent.findUnique({
      where: { walletAddress: agentId },
    });

    if (!agent) {
      logger.warn({ agentId }, 'Agent not found');
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Build query filters
    const whereClause = {
      OR: [
        { fromAgentId: agent.id },
        { toAgentId: agent.id },
      ],
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    // Fetch transactions with related data
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
        include: {
          fromAgent: {
            select: {
              id: true,
              type: true,
              walletAddress: true,
            },
          },
          toAgent: {
            select: {
              id: true,
              type: true,
              walletAddress: true,
            },
          },
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              status: true,
              imageUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({
        where: whereClause,
      }),
    ]);

    // Format transactions for response
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      hash: tx.hash,
      type: tx.fromAgentId === agent.id ? 'SENT' : 'RECEIVED',
      from: {
        id: tx.fromAgent.id,
        type: tx.fromAgent.type,
        address: tx.fromAgent.walletAddress,
      },
      to: {
        id: tx.toAgent.id,
        type: tx.toAgent.type,
        address: tx.toAgent.walletAddress,
      },
      listing: tx.listing ? {
        id: tx.listing.id,
        title: tx.listing.title,
        price: tx.listing.price.toString(),
        status: tx.listing.status,
        imageUrl: tx.listing.imageUrl,
      } : null,
      amount: tx.amount.toString(),
      token: tx.token,
      sourceChain: tx.sourceChain,
      destinationChain: tx.destinationChain,
      nexusRoute: tx.nexusRouteId ? {
        id: tx.nexusRouteId,
        steps: tx.nexusSteps,
        bridgeFee: tx.bridgeFee?.toString(),
        swapFee: tx.swapFee?.toString(),
      } : null,
      status: tx.status,
      blockNumber: tx.blockNumber?.toString(),
      gasUsed: tx.gasUsed?.toString(),
      errorMessage: tx.errorMessage,
      createdAt: tx.createdAt.toISOString(),
      confirmedAt: tx.confirmedAt?.toISOString(),
    }));

    // Calculate summary statistics
    const summary = {
      totalTransactions: totalCount,
      sent: transactions.filter((tx) => tx.fromAgentId === agent.id).length,
      received: transactions.filter((tx) => tx.toAgentId === agent.id).length,
      pending: transactions.filter((tx) => tx.status === 'PENDING').length,
      confirmed: transactions.filter((tx) => tx.status === 'CONFIRMED').length,
      failed: transactions.filter((tx) => tx.status === 'FAILED').length,
    };

    logger.info(
      { agentId, count: transactions.length, total: totalCount },
      'Transaction history fetched successfully'
    );

    return NextResponse.json({
      agent: {
        id: agent.id,
        address: agent.walletAddress,
        type: agent.type,
      },
      transactions: formattedTransactions,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      },
      summary,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch transaction history');
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
 * GET /api/agents/[id]/transactions/stats
 * Returns aggregated transaction statistics for an agent
 */
export async function HEAD(
  request: NextRequest,
  { params }: TransactionHistoryParams
) {
  try {
    const { id } = await params;
    const agentId = id;
    const prisma = getPrismaClient();

    // Find agent
    const agent = await prisma.agent.findUnique({
      where: { walletAddress: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Aggregate statistics
    const [sentStats, receivedStats, statusCounts] = await Promise.all([
      prisma.transaction.aggregate({
        where: { fromAgentId: agent.id },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { toAgentId: agent.id },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.groupBy({
        by: ['status'],
        where: {
          OR: [
            { fromAgentId: agent.id },
            { toAgentId: agent.id },
          ],
        },
        _count: true,
      }),
    ]);

    const stats = {
      agent: {
        id: agent.id,
        address: agent.walletAddress,
        type: agent.type,
      },
      sent: {
        count: sentStats._count,
        totalAmount: sentStats._sum.amount?.toString() || '0',
      },
      received: {
        count: receivedStats._count,
        totalAmount: receivedStats._sum.amount?.toString() || '0',
      },
      byStatus: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json(stats);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch transaction stats');
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
