import {
  A2AMessage,
  A2AResponse,
  A2AResponseSchema,
  type A2AMethod,
} from './types';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.a2a;

/**
 * A2A Client for sending JSON-RPC 2.0 messages
 * Handles communication with the A2A server
 */
export class A2AClient {
  private requestId = 0;
  private readonly endpoint: string;

  constructor(endpoint: string = '/api/a2a') {
    this.endpoint = endpoint;
  }

  /**
   * Call an A2A method
   * @param method - Method name to call
   * @param params - Method parameters
   * @returns Result from the method call
   */
  async call(
    method: A2AMethod,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const requestId = ++this.requestId;

    const message: A2AMessage = {
      jsonrpc: '2.0',
      method,
      params,
      id: requestId,
    };

    logger.info({
      requestId,
      method,
      endpoint: this.endpoint
    }, 'Sending A2A request');

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate response format
      const parsedResponse = A2AResponseSchema.parse(data);

      logger.info({
        requestId,
        method,
        hasError: !!parsedResponse.error
      }, 'Received A2A response');

      // Check for error in response
      if (parsedResponse.error) {
        const error = new Error(parsedResponse.error.message) as Error & {
          code: number;
          data?: unknown;
        };
        error.code = parsedResponse.error.code;
        error.data = parsedResponse.error.data;

        logger.error({
          requestId,
          method,
          errorCode: parsedResponse.error.code,
          errorMessage: parsedResponse.error.message
        }, 'A2A call returned error');

        throw error;
      }

      return parsedResponse.result;
    } catch (error) {
      logger.error({
        err: error,
        requestId,
        method
      }, 'A2A call failed');

      throw error;
    }
  }

  /**
   * Make a notification (one-way message with no response expected)
   * @param method - Method name
   * @param params - Method parameters
   */
  async notify(
    method: A2AMethod,
    params: Record<string, unknown>
  ): Promise<void> {
    const message: Omit<A2AMessage, 'id'> = {
      jsonrpc: '2.0',
      method,
      params,
    };

    logger.info({ method }, 'Sending A2A notification');

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      logger.debug({ method }, 'A2A notification sent');
    } catch (error) {
      logger.error({ err: error, method }, 'A2A notification failed');
      throw error;
    }
  }

  /**
   * Get the endpoint URL
   */
  getEndpoint(): string {
    return this.endpoint;
  }
}

// Default client instance
let defaultClient: A2AClient | null = null;

/**
 * Get or create the default A2A client
 */
export function getA2AClient(): A2AClient {
  if (!defaultClient) {
    defaultClient = new A2AClient();
  }
  return defaultClient;
}
