import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { A2AClient } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

vi.mock('@/lib/utils/logger', () => ({
  loggers: {
    a2a: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

describe('A2AClient', () => {
  let client: A2AClient;

  beforeEach(() => {
    client = new A2AClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('call', () => {
    it('should make successful JSON-RPC call', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        result: [{ listingId: '1', title: 'Test Item' }],
        id: 1,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.call('marketplace.search', { query: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/a2a',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('marketplace.search'),
        })
      );

      expect(result).toEqual([{ listingId: '1', title: 'Test Item' }]);
    });

    it('should throw error when response contains error', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found',
        },
        id: 1,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(client.call('marketplace.search', { query: 'test' })).rejects.toThrow(
        'Method not found'
      );
    });

    it('should increment request ID for each call', async () => {
      const mockResponse = {
        jsonrpc: '2.0',
        result: {},
        id: 1,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await client.call('marketplace.search', { query: 'test1' });
      await client.call('marketplace.search', { query: 'test2' });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      const firstCall = (global.fetch as any).mock.calls[0][1].body;
      const secondCall = (global.fetch as any).mock.calls[1][1].body;

      expect(JSON.parse(firstCall).id).toBe(1);
      expect(JSON.parse(secondCall).id).toBe(2);
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network failure'));

      await expect(client.call('marketplace.search', { query: 'test' })).rejects.toThrow(
        'Network failure'
      );
    });

    it('should validate response schema', async () => {
      const invalidResponse = {
        // Missing jsonrpc field
        result: {},
        id: 1,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse,
      });

      await expect(client.call('marketplace.search', { query: 'test' })).rejects.toThrow();
    });
  });

  describe('notify', () => {
    it('should send notification without expecting response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', result: null, id: null }),
      });

      await client.notify('marketplace.search', { query: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/a2a',
        expect.objectContaining({
          method: 'POST',
          body: expect.not.stringContaining('"id"'),
        })
      );
    });

    it('should throw on notification errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      // Notification throws on network errors
      await expect(client.notify('marketplace.search', { query: 'test' })).rejects.toThrow('Network error');
    });
  });

  describe('custom endpoint', () => {
    it('should use custom endpoint when provided', async () => {
      const customClient = new A2AClient('http://custom-server:8080/a2a');

      const mockResponse = {
        jsonrpc: '2.0',
        result: {},
        id: 1,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await customClient.call('marketplace.search', { query: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://custom-server:8080/a2a',
        expect.any(Object)
      );
    });
  });
});
