import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as imageAnalysis from '@/lib/ai/imageAnalysis';

// Mock the image analysis module
vi.mock('@/lib/ai/imageAnalysis', () => ({
  analyzeProductImage: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/utils/logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully analyze a valid image', async () => {
    const mockImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const mockAnalysisResult = {
      title: 'Nike Air Max 270',
      category: 'Footwear',
      condition: 'New',
      price: 150,
      description: 'Brand new Nike Air Max 270 shoes',
    };

    vi.mocked(imageAnalysis.analyzeProductImage).mockResolvedValueOnce(
      mockAnalysisResult,
    );

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ image: mockImageBase64 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockAnalysisResult);
    expect(imageAnalysis.analyzeProductImage).toHaveBeenCalledWith(mockImageBase64);
  });

  it('should return 400 for missing image data', async () => {
    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Image data is required');
  });

  it('should return 400 for invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for invalid image format', async () => {
    const invalidImage = 'not-a-valid-base64';

    vi.mocked(imageAnalysis.analyzeProductImage).mockRejectedValueOnce(
      new Error('Invalid image format'),
    );

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ image: invalidImage }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Invalid image format');
  });

  it('should return 413 for images exceeding size limit', async () => {
    const largeImage = 'data:image/jpeg;base64,' + 'A'.repeat(15 * 1024 * 1024);

    vi.mocked(imageAnalysis.analyzeProductImage).mockRejectedValueOnce(
      new Error('Image size exceeds 10MB limit'),
    );

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ image: largeImage }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(413);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('exceeds');
  });

  it('should return 429 for rate limit exceeded', async () => {
    vi.mocked(imageAnalysis.analyzeProductImage).mockRejectedValueOnce(
      new Error('Rate limit exceeded'),
    );

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Rate limit');
  });

  it('should return 500 for unexpected errors', async () => {
    vi.mocked(imageAnalysis.analyzeProductImage).mockRejectedValueOnce(
      new Error('Unexpected error'),
    );

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
  });

  it('should handle image analysis timeout', async () => {
    vi.mocked(imageAnalysis.analyzeProductImage).mockRejectedValueOnce(
      new Error('Request timeout'),
    );

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
  });

  it('should include appropriate headers in response', async () => {
    const mockImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const mockAnalysisResult = {
      title: 'Test Product',
      category: 'Electronics',
      condition: 'New',
      price: 100,
      description: 'Test description',
    };

    vi.mocked(imageAnalysis.analyzeProductImage).mockResolvedValueOnce(
      mockAnalysisResult,
    );

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ image: mockImageBase64 }),
    });

    const response = await POST(request);

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('should validate base64 encoding before processing', async () => {
    const mockImageBase64 = 'data:image/jpeg;base64,validBase64Data==';
    const mockAnalysisResult = {
      title: 'Test Product',
      category: 'Electronics',
      condition: 'New',
      price: 100,
      description: 'Test description',
    };

    vi.mocked(imageAnalysis.analyzeProductImage).mockResolvedValueOnce(
      mockAnalysisResult,
    );

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ image: mockImageBase64 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(imageAnalysis.analyzeProductImage).toHaveBeenCalledWith(mockImageBase64);
  });
});
