import { useNotification } from '@blockscout/app-sdk';
import type { TransactionReceipt } from 'viem';
import { loggers } from '../utils/logger';
import { EventEmitter } from 'events';

/**
 * Chain ID mappings for supported networks
 * @see https://chainlist.org/ for chain IDs
 */
export const CHAIN_IDS = {
  ETHEREUM_MAINNET: '1',
  ARBITRUM_ONE: '42161',
  ARBITRUM_SEPOLIA: '421614',
  POLYGON: '137',
  BASE: '8453',
  BASE_SEPOLIA: '84532',
  OPTIMISM: '10',
  HARDHAT: '31337',
} as const;

export type ChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

/**
 * Transaction status tracking
 */
export interface TransactionStatus {
  hash: string;
  chainId: ChainId;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: bigint;
  timestamp?: number;
}

/**
 * Transaction event types
 */
export type TransactionEventType =
  | 'transaction:tracked'
  | 'transaction:pending'
  | 'transaction:confirmed'
  | 'transaction:failed'
  | 'transaction:updated';

/**
 * Transaction event payload
 */
export interface TransactionEvent {
  type: TransactionEventType;
  transaction: TransactionStatus;
  timestamp: number;
}

/**
 * Blockscout monitoring service for transaction tracking
 * Extends EventEmitter to allow components to subscribe to transaction events
 */
export class BlockscoutMonitoringService extends EventEmitter {
  private pendingTransactions: Map<string, TransactionStatus> = new Map();
  private transactionHistory: TransactionStatus[] = [];
  private readonly maxHistorySize = 100;

  constructor() {
    super();
    loggers.monitoring.info('Blockscout monitoring service initialized');
  }

  /**
   * Emit a transaction event
   * @private
   */
  private emitTransactionEvent(type: TransactionEventType, transaction: TransactionStatus): void {
    const event: TransactionEvent = {
      type,
      transaction,
      timestamp: Date.now(),
    };

    this.emit(type, event);
    this.emit('transaction:updated', event);

    loggers.monitoring.debug({ type, hash: transaction.hash }, 'Transaction event emitted');
  }

  /**
   * Track a new transaction
   * @param hash Transaction hash
   * @param chainId Chain ID
   */
  trackTransaction(hash: string, chainId: ChainId): void {
    const transaction: TransactionStatus = {
      hash,
      chainId,
      status: 'pending',
      timestamp: Date.now(),
    };

    this.pendingTransactions.set(hash, transaction);
    loggers.monitoring.info({ hash, chainId }, `Tracking transaction ${hash} on chain ${chainId}`);

    // Emit events
    this.emitTransactionEvent('transaction:tracked', transaction);
    this.emitTransactionEvent('transaction:pending', transaction);
  }

  /**
   * Update transaction status
   * @param hash Transaction hash
   * @param receipt Transaction receipt
   */
  updateTransactionStatus(hash: string, receipt: TransactionReceipt): void {
    const transaction = this.pendingTransactions.get(hash);

    if (transaction) {
      const newStatus = receipt.status === 'success' ? 'confirmed' : 'failed';
      transaction.status = newStatus;
      transaction.blockNumber = Number(receipt.blockNumber);
      transaction.gasUsed = receipt.gasUsed;

      // Move to history
      this.transactionHistory.unshift(transaction);
      if (this.transactionHistory.length > this.maxHistorySize) {
        this.transactionHistory.pop();
      }

      this.pendingTransactions.delete(hash);

      loggers.monitoring.info(
        {
          hash,
          status: transaction.status,
          blockNumber: transaction.blockNumber,
          gasUsed: transaction.gasUsed?.toString(),
        },
        `Transaction ${hash} ${transaction.status}`
      );

      // Emit status-specific event
      if (newStatus === 'confirmed') {
        this.emitTransactionEvent('transaction:confirmed', transaction);
      } else {
        this.emitTransactionEvent('transaction:failed', transaction);
      }
    }
  }

  /**
   * Get all pending transactions
   */
  getPendingTransactions(): TransactionStatus[] {
    return Array.from(this.pendingTransactions.values());
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(): TransactionStatus[] {
    return [...this.transactionHistory];
  }

  /**
   * Get transaction by hash
   */
  getTransaction(hash: string): TransactionStatus | undefined {
    return (
      this.pendingTransactions.get(hash) ||
      this.transactionHistory.find((tx) => tx.hash === hash)
    );
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.pendingTransactions.clear();
    this.transactionHistory = [];
    loggers.monitoring.info('Cleared all transaction data');
  }
}

// Singleton instance
let monitoringServiceInstance: BlockscoutMonitoringService | null = null;

/**
 * Get or create the monitoring service instance
 */
export function getMonitoringService(): BlockscoutMonitoringService {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = new BlockscoutMonitoringService();
  }
  return monitoringServiceInstance;
}

/**
 * Hook for using Blockscout transaction notifications
 * Must be used within BlockscoutProvider
 */
export function useTransactionMonitoring() {
  const notification = useNotification();
  const monitoringService = getMonitoringService();

  /**
   * Monitor a transaction with toast notifications
   */
  const monitorTransaction = (hash: string, chainId: ChainId) => {
    // Track in our service
    monitoringService.trackTransaction(hash, chainId);

    // Show Blockscout notification toast
    notification.openTxToast(chainId, hash);

    loggers.monitoring.debug({ hash, chainId }, `Monitoring transaction via toast notification`);
  };

  /**
   * Open transaction history popup
   */
  const openTransactionHistory = (address?: string) => {
    notification.openPopup({
      chainId: CHAIN_IDS.ARBITRUM_SEPOLIA, // Default to Arbitrum Sepolia
      address,
    });
  };

  return {
    monitorTransaction,
    openTransactionHistory,
    getPendingTransactions: () => monitoringService.getPendingTransactions(),
    getTransactionHistory: () => monitoringService.getTransactionHistory(),
  };
}