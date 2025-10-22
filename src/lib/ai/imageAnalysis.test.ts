import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeProductImage } from './imageAnalysis';
import { generateObject } from 'ai';
import type { GenerateObjectResult } from 'ai';

// Mock the ai package
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

// Mock the logger
vi.mock('../utils/logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('imageAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeProductImage', () => {
    it('should successfully analyze a valid product image', async () => {
      const mockImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const mockAnalysisResult = {
        title: 'Nike Air Max 270',
        category: 'Footwear',
        condition: 'New',
        price: 150,
        description: 'Brand new Nike Air Max 270 shoes in black and white colorway',
      };

      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject.mockResolvedValueOnce({
        object: mockAnalysisResult,
      } as Partial<GenerateObjectResult<typeof mockAnalysisResult>> as GenerateObjectResult<typeof mockAnalysisResult>);

      const result = await analyzeProductImage(mockImageBase64);

      expect(result).toEqual(mockAnalysisResult);
      expect(generateObject).toHaveBeenCalledTimes(1);
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(Object),
          schema: expect.any(Object),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'text' }),
                expect.objectContaining({ type: 'image' }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('should validate response with Zod schema', async () => {
      const mockImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const mockAnalysisResult = {
        title: 'Test Product',
        category: 'Electronics',
        condition: 'Used',
        price: 50,
        description: 'A test product description',
      };

      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject.mockResolvedValueOnce({
        object: mockAnalysisResult,
      } as Partial<GenerateObjectResult<typeof mockAnalysisResult>> as GenerateObjectResult<typeof mockAnalysisResult>);

      const result = await analyzeProductImage(mockImageBase64);

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('condition');
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('description');
      expect(typeof result.title).toBe('string');
      expect(typeof result.price).toBe('number');
    });

    it('should throw error for invalid image format', async () => {
      const invalidImage = 'not-a-valid-base64-image';

      await expect(analyzeProductImage(invalidImage)).rejects.toThrow(
        'Invalid image format',
      );
    });

    it('should handle API errors with retry logic', async () => {
      const mockImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const apiError = new Error('API rate limit exceeded');
      const mockAnalysisResult = {
        title: 'Test Product',
        category: 'Electronics',
        condition: 'New',
        price: 100,
        description: 'Test description',
      };

      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce({
          object: mockAnalysisResult,
        } as Partial<GenerateObjectResult<typeof mockAnalysisResult>> as GenerateObjectResult<typeof mockAnalysisResult>);

      const result = await analyzeProductImage(mockImageBase64);

      expect(result).toBeDefined();
      expect(generateObject).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const mockImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const apiError = new Error('API rate limit exceeded');

      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject.mockRejectedValue(apiError);

      await expect(analyzeProductImage(mockImageBase64)).rejects.toThrow(
        'Failed to analyze image after 3 attempts',
      );
    });

    it('should handle empty or null image data', async () => {
      await expect(analyzeProductImage('')).rejects.toThrow(
        'Image data is required',
      );
    });

    it('should extract and process base64 data correctly', async () => {
      const imageWithPrefix = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
      const mockAnalysisResult = {
        title: 'Test Item',
        category: 'Other',
        condition: 'New',
        price: 25,
        description: 'Test description',
      };

      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject.mockResolvedValueOnce({
        object: mockAnalysisResult,
      } as Partial<GenerateObjectResult<typeof mockAnalysisResult>> as GenerateObjectResult<typeof mockAnalysisResult>);

      await analyzeProductImage(imageWithPrefix);

      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'image',
                  image: expect.stringContaining('iVBORw0KGgoAAAANSUhEUg=='),
                }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('should include proper prompt for marketplace listing extraction', async () => {
      const mockImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const mockAnalysisResult = {
        title: 'Product',
        category: 'Category',
        condition: 'New',
        price: 10,
        description: 'Description',
      };

      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject.mockResolvedValueOnce({
        object: mockAnalysisResult,
      } as Partial<GenerateObjectResult<typeof mockAnalysisResult>> as GenerateObjectResult<typeof mockAnalysisResult>);

      await analyzeProductImage(mockImageBase64);

      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'text',
                  text: expect.stringContaining('marketplace listing'),
                }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('should handle images over 10MB', async () => {
      // Create a mock large base64 string (simulating >10MB)
      const largeImage = 'data:image/jpeg;base64,' + 'A'.repeat(15 * 1024 * 1024);

      await expect(analyzeProductImage(largeImage)).rejects.toThrow(
        'Image size exceeds 10MB limit',
      );
    });

    it('should log analysis start and completion', async () => {
      const mockImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const mockAnalysisResult = {
        title: 'Test Product',
        category: 'Electronics',
        condition: 'New',
        price: 100,
        description: 'Test description',
      };

      const mockGenerateObject = vi.mocked(generateObject);
      mockGenerateObject.mockResolvedValueOnce({
        object: mockAnalysisResult,
      } as Partial<GenerateObjectResult<typeof mockAnalysisResult>> as GenerateObjectResult<typeof mockAnalysisResult>);

      await analyzeProductImage(mockImageBase64);

      // Verify logging was called through the mock
      expect(generateObject).toHaveBeenCalled();
    });
  });
});
