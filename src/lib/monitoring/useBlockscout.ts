'use client';

import { useNotification } from '@blockscout/app-sdk';
import { useCallback } from 'react';
import { getMonitoringService, CHAIN_IDS, type ChainId } from './blockscout.service';

/**
 * React hook for Blockscout transaction monitoring
 * Must be used within BlockscoutProvider
 */
export function useBlockscout() {
  const { openTxToast, openPopup } = useNotification();
  const monitoringService = getMonitoringService();

  /**
   * Monitor a transaction with toast notifications
   */
  const monitorTransaction = useCallback(
    (hash: string, chainId: ChainId = CHAIN_IDS.ARBITRUM_SEPOLIA) => {
      console.log(`[useBlockscout] Monitoring transaction ${hash} on chain ${chainId}`);

      // Track in our service
      monitoringService.trackTransaction(hash, chainId);

      // Show Blockscout notification toast
      openTxToast(chainId, hash);
    },
    [openTxToast]
  );

  /**
   * Open transaction history popup for an address
   */
  const showTransactionHistory = useCallback(
    (address?: string, chainId: ChainId = CHAIN_IDS.ARBITRUM_SEPOLIA) => {
      console.log(`[useBlockscout] Opening transaction history for ${address || 'all'}`);
      openPopup({ chainId, address });
    },
    [openPopup]
  );

  /**
   * Get pending transactions
   */
  const getPendingTransactions = useCallback(() => {
    return monitoringService.getPendingTransactions();
  }, []);

  /**
   * Get transaction history
   */
  const getTransactionHistory = useCallback(() => {
    return monitoringService.getTransactionHistory();
  }, []);

  /**
   * Get specific transaction by hash
   */
  const getTransaction = useCallback((hash: string) => {
    return monitoringService.getTransaction(hash);
  }, []);

  return {
    monitorTransaction,
    showTransactionHistory,
    getPendingTransactions,
    getTransactionHistory,
    getTransaction,
  };
}

export default useBlockscout;