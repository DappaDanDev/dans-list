/**
 * GET /api/listings/[id]
 *
 * Fetch individual listing by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

/**
 * GET handler - Fetch single listing
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const prisma = getPrismaClient();

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        sellerAgent: {
          select: {
            id: true,
            walletAddress: true,
            successRate: true,
            _count: {
              select: {
                listings: true,
                purchases: true,
              },
            },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    logger.info({ listingId: id }, 'Listing fetched successfully');

    return NextResponse.json(
      {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: Number(listing.price) / 1e6,
        category: listing.category,
        condition: listing.condition,
        imageUrl: listing.imageUrl,
        status: listing.status,
        createdAt: listing.createdAt,
        sellerAgent: {
          id: listing.sellerAgent.id,
          walletAddress: listing.sellerAgent.walletAddress,
          successRate: listing.sellerAgent.successRate,
          totalListings: listing.sellerAgent._count.listings,
          totalPurchases: listing.sellerAgent._count.purchases,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch listing');

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch listing' },
      { status: 500 }
    );
  }
}
