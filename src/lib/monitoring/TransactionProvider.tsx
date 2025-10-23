'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  getMonitoringService,
  type TransactionStatus,
  type TransactionEvent,
  type ChainId,
} from './blockscout.service';
import { getLogger } from '../utils/logger';

const logger = getLogger('monitoring:TransactionProvider');

/**
 * Transaction context state
 */
interface TransactionContextState {
  // Transaction lists
  pendingTransactions: TransactionStatus[];
  transactionHistory: TransactionStatus[];

  // Actions
  trackTransaction: (hash: string, chainId: ChainId) => void;
  refreshTransactions: () => void;
  clearTransactions: () => void;

  // Getters
  getTransaction: (hash: string) => TransactionStatus | undefined;

  // State
  isLoading: boolean;
  lastUpdate: Date | null;
}

/**
 * Default context value
 */
const defaultContextValue: TransactionContextState = {
  pendingTransactions: [],
  transactionHistory: [],
  trackTransaction: () => {},
  refreshTransactions: () => {},
  clearTransactions: () => {},
  getTransaction: () => undefined,
  isLoading: false,
  lastUpdate: null,
};

/**
 * Transaction context
 */
const TransactionContext = createContext<TransactionContextState>(defaultContextValue);

/**
 * Transaction provider props
 */
interface TransactionProviderProps {
  children: ReactNode;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * TransactionProvider
 * Provides real-time transaction monitoring via React Context
 *
 * @example
 * ```tsx
 * <TransactionProvider autoRefresh={true}>
 *   <App />
 * </TransactionProvider>
 * ```
 */
export function TransactionProvider({
  children,
  autoRefresh = false,
  refreshInterval = 5000,
}: TransactionProviderProps) {
  const [pendingTransactions, setPendingTransactions] = useState<TransactionStatus[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<TransactionStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const monitoringService = getMonitoringService();

  /**
   * Refresh transaction lists from monitoring service
   */
  const refreshTransactions = useCallback(() => {
    try {
      setIsLoading(true);

      const pending = monitoringService.getPendingTransactions();
      const history = monitoringService.getTransactionHistory();

      setPendingTransactions(pending);
      setTransactionHistory(history);
      setLastUpdate(new Date());

      logger.debug(
        { pending: pending.length, history: history.length },
        'Transactions refreshed'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to refresh transactions');
    } finally {
      setIsLoading(false);
    }
  }, [monitoringService]);

  /**
   * Track a new transaction
   */
  const trackTransaction = useCallback(
    (hash: string, chainId: ChainId) => {
      try {
        monitoringService.trackTransaction(hash, chainId);
        refreshTransactions();
        logger.info({ hash, chainId }, 'Transaction tracked');
      } catch (error) {
        logger.error({ error, hash, chainId }, 'Failed to track transaction');
      }
    },
    [monitoringService, refreshTransactions]
  );

  /**
   * Clear all transactions
   */
  const clearTransactions = useCallback(() => {
    try {
      monitoringService.clear();
      setPendingTransactions([]);
      setTransactionHistory([]);
      setLastUpdate(null);
      logger.info('Transactions cleared');
    } catch (error) {
      logger.error({ error }, 'Failed to clear transactions');
    }
  }, [monitoringService]);

  /**
   * Get transaction by hash
   */
  const getTransaction = useCallback(
    (hash: string) => {
      return monitoringService.getTransaction(hash);
    },
    [monitoringService]
  );

  /**
   * Setup event listeners for real-time updates
   */
  useEffect(() => {
    const handleTransactionUpdate = (event: TransactionEvent) => {
      logger.debug(
        { type: event.type, hash: event.transaction.hash },
        'Transaction event received'
      );
      refreshTransactions();
    };

    // Subscribe to all transaction events
    monitoringService.on('transaction:updated', handleTransactionUpdate);

    // Initial load
    refreshTransactions();

    // Cleanup
    return () => {
      monitoringService.off('transaction:updated', handleTransactionUpdate);
    };
  }, [monitoringService, refreshTransactions]);

  /**
   * Setup auto-refresh interval
   */
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshTransactions();
    }, refreshInterval);

    logger.debug(
      { refreshInterval },
      'Auto-refresh enabled'
    );

    return () => {
      clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, refreshTransactions]);

  const contextValue: TransactionContextState = {
    pendingTransactions,
    transactionHistory,
    trackTransaction,
    refreshTransactions,
    clearTransactions,
    getTransaction,
    isLoading,
    lastUpdate,
  };

  return (
    <TransactionContext.Provider value={contextValue}>
      {children}
    </TransactionContext.Provider>
  );
}

/**
 * Hook to access transaction context
 * Must be used within TransactionProvider
 *
 * @example
 * ```tsx
 * const { pendingTransactions, trackTransaction } = useTransactionContext();
 * ```
 */
export function useTransactionContext(): TransactionContextState {
  const context = useContext(TransactionContext);

  if (context === defaultContextValue) {
    logger.warn('useTransactionContext used outside of TransactionProvider');
  }

  return context;
}
