import { z } from 'zod';

/**
 * A2A (Agent-to-Agent) Protocol Types
 * Implements JSON-RPC 2.0 specification
 * Reference: https://github.com/a2aproject/A2A
 */

// Only implemented methods - no placeholders allowed
const A2AMethodEnum = z.enum([
  'marketplace.search',
  'marketplace.offer',
  'marketplace.accept',
  'marketplace.reject',
  'marketplace.counter',
]);

/**
 * Proof object for wallet verification
 * Included in messages that require authentication
 */
export const ProofSchema = z.object({
  signature: z.string(),
  policyHash: z.string(),
  pkpId: z.string(),
  timestamp: z.number(),
});

export const A2AMessageSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: A2AMethodEnum,
  params: z.record(z.string(), z.unknown()),
  id: z.union([z.string(), z.number()]).optional(),
  proof: ProofSchema.optional(), // CRITICAL: Allows proof in message without rejection
});

export const A2AResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.unknown().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }).optional(),
  id: z.union([z.string(), z.number(), z.null()]),
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;
export type A2AResponse = z.infer<typeof A2AResponseSchema>;
export type A2AMethod = A2AMessage['method'];
export type Proof = z.infer<typeof ProofSchema>;

/**
 * JSON-RPC 2.0 Error Codes
 * Standard codes from spec + custom application codes
 */
export const ErrorCodes = {
  // Standard JSON-RPC errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Custom application errors (starting at -32000)
  LISTING_NOT_FOUND: -32001,
  INSUFFICIENT_FUNDS: -32002,
  UNAUTHORIZED: -32003,
  OFFER_REJECTED: -32004,
  INVALID_PRICE: -32005,
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * A2A Error interface
 */
export interface A2AError {
  code: ErrorCode;
  message: string;
  data?: unknown;
}

/**
 * Handler context passed to method handlers
 */
export interface HandlerContext {
  correlationId: string;
  fromAgent?: string;
  timestamp: number;
}

/**
 * A2A method handler function type
 */
export type A2AHandler = (
  params: Record<string, unknown>,
  context: HandlerContext
) => Promise<unknown>;
