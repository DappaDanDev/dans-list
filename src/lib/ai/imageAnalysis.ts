import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('imageAnalysis');

// Zod schema for listing validation
const listingSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  condition: z.string().min(1).max(50),
  price: z.number().positive(),
  description: z.string().min(10).max(2000),
});

export type ListingData = z.infer<typeof listingSchema>;

// Constants
const MAX_IMAGE_SIZE_MB = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Validates image data format and size
 */
function validateImageData(imageBase64: string): string {
  if (!imageBase64 || imageBase64.trim() === '') {
    logger.error('Image validation failed: empty image data');
    throw new Error('Image data is required');
  }

  // Check if it's a data URL and extract base64
  let base64Data = imageBase64;
  if (imageBase64.startsWith('data:')) {
    const matches = imageBase64.match(/^data:image\/[a-z]+;base64,(.+)$/i);
    if (!matches || matches.length < 2) {
      logger.error('Image validation failed: invalid data URL format');
      throw new Error('Invalid image format');
    }
    base64Data = matches[1];
  }

  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(base64Data)) {
    logger.error('Image validation failed: invalid base64 encoding');
    throw new Error('Invalid image format');
  }

  // Check size (base64 is ~4/3 of original size)
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB > MAX_IMAGE_SIZE_MB) {
    logger.error(
      { sizeInMB, maxSizeInMB: MAX_IMAGE_SIZE_MB },
      'Image validation failed: size exceeds limit',
    );
    throw new Error(`Image size exceeds ${MAX_IMAGE_SIZE_MB}MB limit`);
  }

  logger.debug({ sizeInMB: sizeInMB.toFixed(2) }, 'Image validation successful');
  return base64Data;
}

/**
 * Sleep utility for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Analyzes a product image using OpenAI GPT-4 Vision and extracts structured listing data
 *
 * @param imageBase64 - Base64 encoded image data (with or without data URL prefix)
 * @returns Structured listing data validated with Zod schema
 * @throws Error if image is invalid or analysis fails after retries
 */
export async function analyzeProductImage(
  imageBase64: string,
): Promise<ListingData> {
  const startTime = Date.now();
  logger.info('Starting product image analysis');

  // Validate image data
  const validatedBase64 = validateImageData(imageBase64);

  let lastError: Error | undefined;

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.debug({ attempt, maxRetries: MAX_RETRIES }, 'Attempting image analysis');

      const { object } = await generateObject({
        model: openai('gpt-4o'),
        schema: listingSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this product image and extract marketplace listing details.

                Provide:
                - A clear, descriptive title (max 200 chars)
                - The product category (e.g., Electronics, Clothing, Footwear, Furniture, etc.)
                - The condition (e.g., New, Like New, Used, Refurbished)
                - A fair market price in USD (numeric value only)
                - A detailed description including visible features, brand, model, color, and any notable characteristics (min 10 chars, max 2000 chars)

                Be specific and accurate based only on what you can see in the image.`,
              },
              {
                type: 'image',
                image: validatedBase64,
              },
            ],
          },
        ],
      });

      const duration = Date.now() - startTime;
      logger.info(
        {
          duration,
          attempt,
          title: object.title,
          category: object.category,
          price: object.price,
        },
        'Image analysis completed successfully',
      );

      return object;
    } catch (error) {
      lastError = error as Error;
      logger.warn(
        {
          attempt,
          maxRetries: MAX_RETRIES,
          error: lastError.message,
        },
        'Image analysis attempt failed',
      );

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        logger.debug({ delay }, 'Waiting before retry');
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  const duration = Date.now() - startTime;
  logger.error(
    {
      duration,
      attempts: MAX_RETRIES,
      lastError: lastError?.message,
    },
    'Image analysis failed after all retry attempts',
  );

  throw new Error(`Failed to analyze image after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Batch analyze multiple product images
 *
 * @param images - Array of base64 encoded images
 * @returns Array of listing data results
 */
export async function batchAnalyzeProductImages(
  images: string[],
): Promise<ListingData[]> {
  logger.info({ count: images.length }, 'Starting batch image analysis');

  const results = await Promise.allSettled(
    images.map((image) => analyzeProductImage(image)),
  );

  const successful = results.filter(
    (r): r is PromiseFulfilledResult<ListingData> => r.status === 'fulfilled',
  );
  const failed = results.filter((r) => r.status === 'rejected');

  logger.info(
    {
      total: images.length,
      successful: successful.length,
      failed: failed.length,
    },
    'Batch image analysis completed',
  );

  return successful.map((r) => r.value);
}
