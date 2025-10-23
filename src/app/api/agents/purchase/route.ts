/**
 * POST /api/agents/purchase
 *
 * Execute agent purchase flow
 * Orchestrates: PyUSD → USDC swap + cross-chain transfer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentService } from '@/lib/agents/agent.service';
import type { PurchaseParams } from '@/lib/agents/agent.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

/**
 * Request body schema
 */
interface PurchaseRequest {
  buyerAgentId: string;
  sellerWalletAddress: string;
  pyusdAmount: number;
  fromChainId: number;
  toChainId: number;
  listingId: string;
}

/**
 * Response schema
 */
interface PurchaseResponse {
  success: boolean;
  swapTxHash?: string;
  transferExplorerUrl?: string;
  usdcAmount?: string;
  error?: string;
}

/**
 * POST handler - Execute agent purchase
 */
export async function POST(req: NextRequest): Promise<NextResponse<PurchaseResponse>> {
  try {
    const body = (await req.json()) as PurchaseRequest;

    // Validate request body
    const validationError = validatePurchaseRequest(body);
    if (validationError) {
      logger.warn({ validationError }, 'Invalid purchase request');
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    logger.info(
      {
        buyerAgentId: body.buyerAgentId,
        listingId: body.listingId,
        pyusdAmount: body.pyusdAmount,
        fromChain: body.fromChainId,
        toChain: body.toChainId,
      },
      'Starting agent purchase'
    );

    // Execute purchase flow
    const agentService = getAgentService();

    const params: PurchaseParams = {
      buyerAgentId: body.buyerAgentId,
      sellerWalletAddress: body.sellerWalletAddress,
      pyusdAmount: body.pyusdAmount,
      fromChainId: body.fromChainId,
      toChainId: body.toChainId,
      listingId: body.listingId,
    };

    const result = await agentService.executePurchase(params);

    if (!result.success) {
      logger.error(
        {
          buyerAgentId: body.buyerAgentId,
          listingId: body.listingId,
          error: result.error,
        },
        'Purchase execution failed'
      );

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Purchase failed',
        },
        { status: 500 }
      );
    }

    logger.info(
      {
        buyerAgentId: body.buyerAgentId,
        listingId: body.listingId,
        swapTxHash: result.swapTxHash,
        usdcAmount: result.usdcAmount,
      },
      'Purchase executed successfully'
    );

    return NextResponse.json(
      {
        success: true,
        swapTxHash: result.swapTxHash,
        transferExplorerUrl: result.transferExplorerUrl,
        usdcAmount: result.usdcAmount,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Purchase request failed');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase request failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Validate purchase request body
 */
function validatePurchaseRequest(body: unknown): string | null {
  // Type guard to ensure body is an object
  if (!body || typeof body !== 'object') {
    return 'Request body must be an object';
  }

  const req = body as Record<string, unknown>;
  if (!req.buyerAgentId || typeof req.buyerAgentId !== 'string') {
    return 'buyerAgentId is required and must be a string';
  }

  if (!req.sellerWalletAddress || typeof req.sellerWalletAddress !== 'string') {
    return 'sellerWalletAddress is required and must be a string';
  }

  // Basic Ethereum address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(req.sellerWalletAddress)) {
    return 'sellerWalletAddress must be a valid Ethereum address';
  }

  if (typeof req.pyusdAmount !== 'number' || req.pyusdAmount <= 0) {
    return 'pyusdAmount is required and must be a positive number';
  }

  if (typeof req.fromChainId !== 'number') {
    return 'fromChainId is required and must be a number';
  }

  if (typeof req.toChainId !== 'number') {
    return 'toChainId is required and must be a number';
  }

  // Validate supported chains (ETH Sepolia and Arbitrum Sepolia)
  const supportedChains = [11155111, 421614];
  if (!supportedChains.includes(req.fromChainId)) {
    return `fromChainId must be one of: ${supportedChains.join(', ')}`;
  }

  if (!supportedChains.includes(req.toChainId)) {
    return `toChainId must be one of: ${supportedChains.join(', ')}`;
  }

  if (!req.listingId || typeof req.listingId !== 'string') {
    return 'listingId is required and must be a string';
  }

  return null;
}
