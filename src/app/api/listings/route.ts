/**
 * GET /api/listings
 *
 * Fetch marketplace listings with pagination and filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

/**
 * Response schema
 */
interface ListingsResponse {
  listings: unknown[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * GET handler - Fetch listings with pagination and filters
 */
export async function GET(req: NextRequest): Promise<NextResponse<ListingsResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(req.url);

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured');
    const sellerAddress = searchParams.get('sellerAddress');
    const status = searchParams.get('status') || 'AVAILABLE';

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();

    // Build where clause
    const where: {
      status?: string;
      category?: string;
      sellerAgent?: { walletAddress?: string };
      OR?: Array<{ title?: { contains: string }; description?: { contains: string } }>;
    } = {};

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (sellerAddress) {
      where.sellerAgent = { walletAddress: sellerAddress };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Fetch listings
    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: featured === 'true'
          ? { createdAt: 'desc' }
          : { createdAt: 'desc' },
        include: {
          sellerAgent: {
            select: {
              id: true,
              walletAddress: true,
            },
          },
        },
      }),
      prisma.listing.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Log before returning to avoid worker exit race condition
    try {
      logger.info(
        {
          page,
          limit,
          total,
          category,
          search,
          featured,
        },
        'Listings fetched successfully'
      );
    } catch (logError) {
      // Ignore logging errors to prevent worker crashes
      console.error('Logger error:', logError);
    }

    return NextResponse.json(
      {
        listings,
        page,
        limit,
        total,
        totalPages,
      },
      { status: 200 }
    );
  } catch (error) {
    try {
      logger.error({ err: error }, 'Failed to fetch listings');
    } catch (logError) {
      // Ignore logging errors to prevent worker crashes
      console.error('Logger error:', logError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Create new listing
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Validate required fields
    const { title, description, price, category, sellerAddress, imageUrl } = body;

    if (!title || !description || !price || !category || !sellerAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate seller address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(sellerAddress)) {
      return NextResponse.json(
        { error: 'Invalid seller address format' },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();

    // Check if seller agent exists, create if not
    let sellerAgent = await prisma.agent.findUnique({
      where: { walletAddress: sellerAddress },
    });

    if (!sellerAgent) {
      sellerAgent = await prisma.agent.create({
        data: {
          type: 'SELLER',
          walletAddress: sellerAddress,
          policies: {},
          spendingLimit: 10000,
          dailyLimit: 1000,
          totalTransactions: 0,
          successRate: 100,
          totalVolume: 0,
        },
      });
    }

    // Create listing
    const listing = await prisma.listing.create({
      data: {
        title,
        description,
        price: Math.floor(price * 1e6), // Convert to 6 decimals
        category,
        sellerAgentId: sellerAgent.id,
        imageUrl: imageUrl || '',
        status: 'AVAILABLE',
        condition: body.condition || 'Good',
        features: {},
      },
    });

    // Update seller's last activity
    await prisma.agent.update({
      where: { id: sellerAgent.id },
      data: {
        lastActivity: new Date(),
      },
    });

    logger.info(
      {
        listingId: listing.id,
        sellerAgentId: sellerAgent.id,
        price,
      },
      'Listing created successfully'
    );

    return NextResponse.json(
      {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: Number(listing.price) / 1e6,
        category: listing.category,
        imageUrl: listing.imageUrl,
        status: listing.status,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to create listing');

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create listing' },
      { status: 500 }
    );
  }
}
