import { NextRequest, NextResponse } from 'next/server';
import { getA2AServer } from '@/lib/agents/a2a/server';
import { getSearchAgent } from '@/lib/agents/marketplace/search.agent';
import { loggers } from '@/lib/utils/logger';
import type { SearchQuery } from '@/lib/agents/marketplace/types';

const logger = loggers.a2a;

// Initialize A2A server and register handlers
const a2aServer = getA2AServer();
const searchAgent = getSearchAgent();

// Register marketplace.search handler - FULLY IMPLEMENTED
a2aServer.registerHandler('marketplace.search', async (params) => {
  const { query, maxResults, priceRange, category } = params;

  const searchQuery: SearchQuery = {
    query: String(query),
    maxResults: maxResults as number | undefined,
    priceRange: priceRange as { min: number; max: number } | undefined,
    category: category as string | undefined,
  };

  return await searchAgent.semanticSearch(searchQuery);
});

// NOTE: marketplace.offer, marketplace.accept, marketplace.reject, marketplace.counter
// handlers removed per code review - no placeholder/dummy data allowed.
// These will be re-added when Vincent/Nexus integration is complete (Task 3.7).

/**
 * POST /api/a2a
 * Handle A2A JSON-RPC 2.0 requests
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const response = await a2aServer.handleMessage(body);

    const duration = Date.now() - startTime;
    logger.info({
      duration,
      method: body.method,
      hasError: !!response.error
    }, 'A2A request processed');

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': String(response.id),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'A2A route error');

    return NextResponse.json({
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: 'Parse error',
      },
      id: null,
    }, { status: 400 });
  }
}

/**
 * GET /api/a2a
 * Return server information
 */
export async function GET() {
  const stats = a2aServer.getStats();

  return NextResponse.json({
    name: 'Dans List A2A Server',
    version: '1.0.0',
    protocol: 'JSON-RPC 2.0',
    stats,
  });
}
