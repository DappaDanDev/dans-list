import { PrismaClient } from '@/generated/prisma';
import { loggers } from '../utils/logger';

// Singleton instance
let prisma: PrismaClient | undefined;

/**
 * Get or create the Prisma client instance
 * Implements singleton pattern to avoid multiple connections
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
      errorFormat: 'pretty',
    });
  }

  return prisma;
}

/**
 * Initialize database connection
 * Must be called before using the client
 */
export async function initializeDatabase(): Promise<void> {
  const client = getPrismaClient();

  try {
    loggers.prisma.info('Initializing database connection');
    await client.$connect();
    loggers.prisma.info('Database connected successfully');
  } catch (error) {
    loggers.prisma.error({ err: error }, 'Database connection failed');
    throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Disconnect from the database
 * Should be called on application shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    loggers.prisma.info('Disconnecting from database');
    await prisma.$disconnect();
    prisma = undefined;
  }
}

/**
 * Database health check
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    loggers.prisma.error({ err: error }, 'Health check failed');
    return false;
  }
}

// Export types for convenience
export type {
  Listing,
  Agent,
  Transaction,
  Proof,
  Message,
  MarketMetrics,
  EventLog,
  ListingStatus,
  AgentType,
  TransactionStatus,
  ProofType
} from '@/generated/prisma';

export { ListingStatus, AgentType, TransactionStatus, ProofType } from '@/generated/prisma';