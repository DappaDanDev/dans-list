import { NextRequest, NextResponse } from 'next/server';
import { analyzeProductImage } from '@/lib/ai/imageAnalysis';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('api:analyze');

// Allow larger multipart payloads (default ~1MB is too small for images)
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '10mb',
  },
};

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
    const formData = await req.formData();
    const imageField = formData.get('image');

    if (!imageField) {
      logger.warn({ clientIp }, 'Missing image field in form data');
      return NextResponse.json(
        { error: 'Image field is required' },
        { status: 400 },
      );
    }

    let base64Image: string;

    if (typeof imageField === 'string') {
      base64Image = imageField;
    } else {
      const arrayBuffer = await imageField.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = imageField.type || 'image/png';
      base64Image = `data:${mimeType};base64,${base64}`;
    }

    // Analyze the image
    logger.debug({ clientIp, imageLength: base64Image.length }, 'Starting image analysis');

    const result = await analyzeProductImage(base64Image);

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
