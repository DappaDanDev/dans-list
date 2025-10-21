import pino from 'pino';
import type { Logger } from 'pino';

/**
 * Configure Pino logger with appropriate settings for environment
 */
const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

/**
 * Base logger configuration
 */
const baseLogger = pino({
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
    // Custom serializer for blockchain data
    tx: (transaction: any) => ({
      hash: transaction.hash,
      from: transaction.from,
      to: transaction.to,
      value: transaction.value?.toString(),
      gasUsed: transaction.gasUsed?.toString(),
      status: transaction.status,
    }),
    // Custom serializer for agent data
    agent: (agent: any) => ({
      id: agent.id,
      type: agent.type,
      wallet: agent.walletAddress?.slice(0, 10) + '...',
    }),
  },
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
            errorLikeObjectKeys: ['err', 'error'],
          },
        },
      }
    : {}),
});

/**
 * Create a child logger with a specific component name
 * @param name - Component/service name
 * @returns Logger instance with component context
 */
export function createLogger(name: string): Logger {
  return baseLogger.child({ component: name });
}

/**
 * Log levels and their usage:
 * - fatal: Application is going to stop or become unusable
 * - error: Fatal for a operation, but the application continues
 * - warn: Something concerning happened but recovery is possible
 * - info: Valuable information for production logs
 * - debug: Detailed information for debugging
 * - trace: Most detailed information (not for production)
 */

// Export the base logger for direct usage
export const logger = baseLogger;

// Convenience loggers for common services
export const loggers = {
  api: createLogger('API'),
  database: createLogger('Database'),
  blockchain: createLogger('Blockchain'),
  ai: createLogger('AI'),
  agent: createLogger('Agent'),
  monitoring: createLogger('Monitoring'),
  envio: createLogger('Envio'),
  hardhat: createLogger('Hardhat'),
  prisma: createLogger('Prisma'),
};

// Type exports
export type { Logger } from 'pino';

// Logging utilities
export const logUtils = {
  /**
   * Log API request
   */
  logApiRequest: (method: string, path: string, params?: any) => {
    loggers.api.info({ method, path, params }, `API Request: ${method} ${path}`);
  },

  /**
   * Log API response
   */
  logApiResponse: (method: string, path: string, status: number, duration: number) => {
    loggers.api.info(
      { method, path, status, duration },
      `API Response: ${method} ${path} - ${status} (${duration}ms)`
    );
  },

  /**
   * Log blockchain transaction
   */
  logTransaction: (action: string, tx: any) => {
    loggers.blockchain.info({ action, tx }, `Blockchain: ${action}`);
  },

  /**
   * Log database operation
   */
  logDatabaseOperation: (operation: string, model: string, duration?: number) => {
    loggers.database.debug(
      { operation, model, duration },
      `Database: ${operation} on ${model}`
    );
  },

  /**
   * Log AI operation
   */
  logAiOperation: (operation: string, details: any) => {
    loggers.ai.info({ operation, ...details }, `AI: ${operation}`);
  },

  /**
   * Log agent action
   */
  logAgentAction: (agentId: string, action: string, details?: any) => {
    loggers.agent.info({ agentId, action, ...details }, `Agent ${agentId}: ${action}`);
  },

  /**
   * Log error with context
   */
  logError: (component: string, error: Error, context?: any) => {
    createLogger(component).error({ err: error, ...context }, error.message);
  },

  /**
   * Log performance metric
   */
  logPerformance: (operation: string, duration: number, metadata?: any) => {
    if (duration > 1000) {
      // Log as warning if operation took more than 1 second
      baseLogger.warn(
        { operation, duration, ...metadata },
        `Slow operation: ${operation} took ${duration}ms`
      );
    } else {
      baseLogger.debug(
        { operation, duration, ...metadata },
        `Performance: ${operation} took ${duration}ms`
      );
    }
  },
};