import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A2AServer } from '../server';
import { ErrorCodes } from '../types';

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

describe('A2AServer', () => {
  let server: A2AServer;

  beforeEach(() => {
    server = new A2AServer();
  });

  describe('handleMessage', () => {
    it('returns error for invalid JSON-RPC format', async () => {
      const response = await server.handleMessage({ invalid: 'message' });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(ErrorCodes.INVALID_REQUEST);
      expect(response.id).toBeNull();
    });

    it('returns error for invalid method in schema', async () => {
      const message = {
        jsonrpc: '2.0',
        method: 'unknown.method',
        params: {},
        id: 1,
      };

      const response = await server.handleMessage(message);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(ErrorCodes.INVALID_REQUEST); // Fails schema validation
    });

    it('executes registered handler and returns result', async () => {
      server.registerHandler('marketplace.search', async () => {
        return { results: [{ id: '1', title: 'Test' }] };
      });

      const message = {
        jsonrpc: '2.0',
        method: 'marketplace.search',
        params: { query: 'test' },
        id: 1,
      };

      const response = await server.handleMessage(message);

      expect(response.result).toEqual({ results: [{ id: '1', title: 'Test' }] });
      expect(response.error).toBeUndefined();
      expect(response.id).toBe(1);
    });

    it('returns error when handler throws', async () => {
      server.registerHandler('marketplace.search', async () => {
        throw new Error('Handler error');
      });

      const message = {
        jsonrpc: '2.0',
        method: 'marketplace.search',
        params: {},
        id: 1,
      };

      const response = await server.handleMessage(message);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(response.error?.message).toContain('Handler error');
    });

    it('handles message without ID', async () => {
      server.registerHandler('marketplace.search', async () => ({ success: true }));

      const message = {
        jsonrpc: '2.0',
        method: 'marketplace.search',
        params: {},
      };

      const response = await server.handleMessage(message);

      expect(response.id).toBeNull();
      expect(response.result).toEqual({ success: true });
    });

    it('passes context to handler', async () => {
      let receivedContext: any;

      server.registerHandler('marketplace.search', async (params, context) => {
        receivedContext = context;
        return { success: true };
      });

      await server.handleMessage({
        jsonrpc: '2.0',
        method: 'marketplace.search',
        params: {},
        id: 1,
      });

      expect(receivedContext).toBeDefined();
      expect(receivedContext.correlationId).toBeDefined();
      expect(receivedContext.timestamp).toBeDefined();
    });
  });

  describe('registerHandler', () => {
    it('registers a handler for a method', () => {
      const handler = vi.fn();
      server.registerHandler('marketplace.search', handler);

      const stats = server.getStats();
      expect(stats.registeredMethods).toContain('marketplace.search');
    });
  });

  describe('getStats', () => {
    it('returns server statistics', () => {
      server.registerHandler('marketplace.search', async () => ({}));
      server.registerHandler('marketplace.offer', async () => ({}));

      const stats = server.getStats();

      expect(stats.registeredMethods).toHaveLength(2);
      expect(stats.handlersCount).toBe(2);
    });
  });

  describe('clearHandlers', () => {
    it('removes all registered handlers', () => {
      server.registerHandler('marketplace.search', async () => ({}));
      server.clearHandlers();

      const stats = server.getStats();
      expect(stats.handlersCount).toBe(0);
    });
  });
});
