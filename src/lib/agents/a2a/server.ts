import {
  A2AMessage,
  A2AResponse,
  A2AMessageSchema,
  ErrorCodes,
  type A2AHandler,
  type HandlerContext,
  type Proof,
} from './types';
import { loggers } from '@/lib/utils/logger';
import { randomUUID } from 'crypto';
import { VincentWalletService } from '@/lib/vincent/wallet.service';

const logger = loggers.a2a;

/**
 * A2A Server implementing JSON-RPC 2.0
 * Handles agent-to-agent communication with proper error handling and logging
 */
export class A2AServer {
  private handlers = new Map<string, A2AHandler>();
  private requestCount = 0;
  private vincentService: VincentWalletService;

  constructor(vincentService?: VincentWalletService) {
    this.vincentService = vincentService || new VincentWalletService();
  }

  /**
   * Register a handler for a specific A2A method
   * @param method - Method name (e.g., 'marketplace.search')
   * @param handler - Handler function to process the method
   */
  registerHandler(method: string, handler: A2AHandler): void {
    logger.info({ method }, 'Registering A2A handler');
    this.handlers.set(method, handler);
  }

  /**
   * Handle an incoming A2A message
   * @param rawMessage - Raw message to process (will be validated)
   * @returns JSON-RPC 2.0 compliant response
   */
  async handleMessage(rawMessage: unknown): Promise<A2AResponse> {
    const correlationId = randomUUID();
    const startTime = Date.now();
    this.requestCount++;

    logger.info({
      correlationId,
      requestNumber: this.requestCount
    }, 'Received A2A message');

    // 1. Validate JSON-RPC 2.0 format
    const parseResult = A2AMessageSchema.safeParse(rawMessage);
    if (!parseResult.success) {
      logger.error({
        correlationId,
        error: parseResult.error,
        rawMessage
      }, 'Invalid A2A message format');

      return this.errorResponse(
        null,
        ErrorCodes.INVALID_REQUEST,
        'Invalid JSON-RPC 2.0 message',
        parseResult.error
      );
    }

    const message = parseResult.data;

    try {
      // 2. Find handler for method
      const handler = this.handlers.get(message.method);
      if (!handler) {
        logger.warn({
          correlationId,
          method: message.method
        }, 'Method not found');

        return this.errorResponse(
          message.id || null,
          ErrorCodes.METHOD_NOT_FOUND,
          `Method not found: ${message.method}`
        );
      }

      // 3. Validate proof for authenticated methods
      const AUTHENTICATED_METHODS = [
        'marketplace.offer',
        'marketplace.accept',
        'marketplace.reject',
        'marketplace.counter',
      ];

      const requiresAuth = AUTHENTICATED_METHODS.includes(message.method);

      if (requiresAuth || message.proof) {
        // Extract agentId from params (convention: fromAgentId or agentId)
        const agentId = (message.params.fromAgentId || message.params.agentId) as string;

        if (!agentId) {
          logger.warn({
            correlationId,
            method: message.method
          }, 'Missing agentId in authenticated request');

          return this.errorResponse(
            message.id || null,
            ErrorCodes.INVALID_PARAMS,
            'agentId required for authenticated methods'
          );
        }

        // Validate proof signature
        const messageToSign = JSON.stringify({
          method: message.method,
          params: message.params,
          timestamp: message.proof?.timestamp,
        });

        const isValid = await this.validateProof(message.proof, agentId, messageToSign);

        if (!isValid) {
          logger.warn({
            correlationId,
            method: message.method,
            agentId
          }, 'Proof validation failed');

          return this.errorResponse(
            message.id || null,
            ErrorCodes.UNAUTHORIZED,
            'Invalid or missing proof signature'
          );
        }

        logger.info({ correlationId, agentId }, 'Proof validated successfully');
      }

      // 4. Execute handler with context
      const context: HandlerContext = {
        correlationId,
        timestamp: Date.now(),
      };

      logger.debug({
        correlationId,
        method: message.method,
        params: message.params
      }, 'Executing handler');

      const result = await handler(message.params, context);

      const duration = Date.now() - startTime;
      logger.info({
        correlationId,
        method: message.method,
        duration
      }, 'A2A message handled successfully');

      return {
        jsonrpc: '2.0',
        result,
        id: message.id || null,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({
        err: error,
        correlationId,
        method: message.method,
        duration
      }, 'A2A handler error');

      return this.errorResponse(
        message.id || null,
        ErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        error
      );
    }
  }

  /**
   * Validate proof signature for authenticated methods
   * @param proof - Proof object containing signature and metadata
   * @param agentId - Agent ID to verify ownership
   * @param message - Original message being signed (for verification)
   * @returns true if valid, false otherwise
   */
  private async validateProof(
    proof: Proof | undefined,
    agentId: string,
    message: string
  ): Promise<boolean> {
    if (!proof) {
      logger.warn({ agentId }, 'No proof provided for authenticated request');
      return false;
    }

    try {
      // Check timestamp freshness (10 minute window)
      const now = Date.now();
      const proofAge = now - proof.timestamp;
      const MAX_PROOF_AGE = 10 * 60 * 1000; // 10 minutes

      if (proofAge > MAX_PROOF_AGE) {
        logger.warn({
          agentId,
          proofAge,
          maxAge: MAX_PROOF_AGE
        }, 'Proof timestamp too old');
        return false;
      }

      // Verify signature using Vincent service
      const isValid = await this.vincentService.verifyWalletOwnership(
        agentId,
        proof.signature,
        message
      );

      if (!isValid) {
        logger.warn({ agentId, pkpId: proof.pkpId }, 'Invalid proof signature');
        return false;
      }

      logger.debug({ agentId, pkpId: proof.pkpId }, 'Proof validated successfully');
      return true;
    } catch (error) {
      logger.error({ err: error, agentId }, 'Error validating proof');
      return false;
    }
  }

  /**
   * Create a JSON-RPC 2.0 compliant error response
   */
  private errorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): A2AResponse {
    return {
      jsonrpc: '2.0',
      error: { code, message, data },
      id,
    };
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      registeredMethods: Array.from(this.handlers.keys()),
      handlersCount: this.handlers.size,
    };
  }

  /**
   * Clear all registered handlers (useful for testing)
   */
  clearHandlers(): void {
    this.handlers.clear();
    logger.info('All handlers cleared');
  }
}

// Singleton instance
let serverInstance: A2AServer | null = null;

/**
 * Get or create the A2A server instance
 */
export function getA2AServer(): A2AServer {
  if (!serverInstance) {
    serverInstance = new A2AServer();
  }
  return serverInstance;
}
