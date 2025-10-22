import { NextRequest, NextResponse } from 'next/server';
import { analyzeProductImage } from '@/lib/ai/imageAnalysis';
import { getLogger } from '@/lib/utils/logger';

const logger = getLogger('api:analyze');

/**
 * POST /api/analyze
 * Analyzes a product image and returns structured listing data
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const clientIp =
    req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  logger.info({ clientIp }, 'Image analysis request received');

  try {
    // Parse request body
    let body: { image?: string };
    try {
      body = await req.json();
    } catch (error) {
      logger.warn({ error, clientIp }, 'Invalid JSON in request body');
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    // Validate image data
    const { image } = body;
    if (!image || typeof image !== 'string' || image.trim() === '') {
      logger.warn({ clientIp }, 'Missing or invalid image data');
      return NextResponse.json(
        { error: 'Image data is required and must be a string' },
        { status: 400 },
      );
    }

    // Analyze the image
    logger.debug({ clientIp, imageLength: image.length }, 'Starting image analysis');

    const result = await analyzeProductImage(image);

    const duration = Date.now() - startTime;
    logger.info(
      {
        clientIp,
        duration,
        title: result.title,
        category: result.category,
        price: result.price,
      },
      'Image analysis completed successfully',
    );

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=900', // Cache for 15 minutes
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        clientIp,
        duration,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Image analysis failed',
    );

    // Determine appropriate status code based on error
    if (errorMessage.includes('Image data is required')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    if (errorMessage.includes('Invalid image format')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    if (errorMessage.includes('exceeds')) {
      return NextResponse.json({ error: errorMessage }, { status: 413 });
    }

    if (errorMessage.includes('Rate limit')) {
      return NextResponse.json({ error: errorMessage }, { status: 429 });
    }

    // Generic error response
    return NextResponse.json(
      {
        error: 'Failed to analyze image',
        message: errorMessage,
      },
      { status: 500 },
    );
  }
}
