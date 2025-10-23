'use client';

import { useEffect, useState, useCallback } from 'react';
import { getLogger } from '@/lib/utils/logger';
import { useTransactionContext } from '@/lib/monitoring/TransactionProvider';

const logger = getLogger('components:TransactionHistory');

/**
 * Transaction data structure returned from API
 */
interface Transaction {
  id: string;
  hash: string;
  type: 'SENT' | 'RECEIVED';
  from: {
    id: string;
    type: string;
    address: string;
  };
  to: {
    id: string;
    type: string;
    address: string;
  };
  listing: {
    id: string;
    title: string;
    price: string;
    status: string;
    imageUrl: string;
  } | null;
  amount: string;
  token: string;
  sourceChain: number;
  destinationChain: number;
  nexusRoute: {
    id: string;
    steps: any[];
    bridgeFee: string;
    swapFee: string;
  } | null;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REVERTED';
  blockNumber?: string;
  gasUsed?: string;
  errorMessage?: string;
  createdAt: string;
  confirmedAt?: string;
}

interface TransactionHistoryResponse {
  agent: {
    id: string;
    address: string;
    type: string;
  };
  transactions: Transaction[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  summary: {
    totalTransactions: number;
    sent: number;
    received: number;
    pending: number;
    confirmed: number;
    failed: number;
  };
}

interface TransactionHistoryProps {
  agentAddress: string;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  useContext?: boolean; // Enable real-time updates via TransactionProvider
}

/**
 * TransactionHistory Component
 * Displays transaction history for a given agent address
 *
 * @param useContext - Enable real-time updates via TransactionProvider context
 */
export function TransactionHistory({
  agentAddress,
  limit = 20,
  autoRefresh = false,
  refreshInterval = 10000,
  useContext: useContextUpdates = false,
}: TransactionHistoryProps) {
  const [data, setData] = useState<TransactionHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Optional: Use transaction context for real-time updates
  const transactionContext = useContextUpdates ? useTransactionContext() : null;

  /**
   * Fetch transaction history from API
   */
  const fetchTransactions = useCallback(async () => {
    try {
      logger.info({ agentAddress, limit, offset, statusFilter }, 'Fetching transaction history');

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...(statusFilter ? { status: statusFilter } : {}),
      });

      const response = await fetch(
        `/api/agents/${agentAddress}/transactions?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: TransactionHistoryResponse = await response.json();
      setData(result);
      setError(null);
      logger.info({ count: result.transactions.length }, 'Transaction history fetched');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to fetch transaction history');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [agentAddress, limit, offset, statusFilter]);

  /**
   * Setup initial fetch and auto-refresh
   */
  useEffect(() => {
    fetchTransactions();

    if (!autoRefresh) return;

    const interval = setInterval(fetchTransactions, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchTransactions, autoRefresh, refreshInterval]);

  /**
   * Listen to context updates for real-time transaction monitoring
   */
  useEffect(() => {
    if (!useContextUpdates || !transactionContext) return;

    // Refresh when context updates
    logger.debug('Context update detected, refreshing transactions');
    fetchTransactions();
  }, [
    useContextUpdates,
    transactionContext?.lastUpdate,
    fetchTransactions,
  ]);

  /**
   * Truncate address for display
   */
  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status: Transaction['status']): string => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'REVERTED':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  /**
   * Get transaction type badge color
   */
  const getTypeColor = (type: Transaction['type']): string => {
    return type === 'SENT'
      ? 'bg-blue-100 text-blue-800 border-blue-300'
      : 'bg-purple-100 text-purple-800 border-purple-300';
  };

  /**
   * Get chain name
   */
  const getChainName = (chainId: number): string => {
    const chains: Record<number, string> = {
      84532: 'Base Sepolia',
      421614: 'Arbitrum Sepolia',
      1: 'Ethereum',
      31337: 'Hardhat',
    };
    return chains[chainId] || `Chain ${chainId}`;
  };

  /**
   * Get block explorer URL
   */
  const getExplorerUrl = (hash: string, chainId: number): string => {
    const explorers: Record<number, string> = {
      84532: 'https://sepolia.basescan.org',
      421614: 'https://sepolia.arbiscan.io',
      1: 'https://etherscan.io',
    };
    const baseUrl = explorers[chainId];
    return baseUrl ? `${baseUrl}/tx/${hash}` : '#';
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading transaction history...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-500 bg-red-50 p-4">
        <h3 className="font-semibold text-red-800">Error Loading Transactions</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => fetchTransactions()}
          className="mt-2 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary Statistics */}
      <div className="rounded-lg border border-gray-300 bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Transaction History</h2>
            {useContextUpdates && transactionContext && (
              <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs text-green-800">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                Live Updates
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOffset(0); // Reset to first page when filtering
              }}
              className="rounded border border-gray-300 px-3 py-1 text-sm"
            >
              <option value="">All Status</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REVERTED">Reverted</option>
            </select>
            <button
              onClick={() => fetchTransactions()}
              className="rounded bg-blue-600 px-4 py-1 text-sm text-white hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-600">Total</p>
            <p className="text-xl font-bold">{data.summary.totalTransactions}</p>
          </div>
          <div className="rounded border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-600">Sent</p>
            <p className="text-xl font-bold text-blue-800">{data.summary.sent}</p>
          </div>
          <div className="rounded border border-purple-200 bg-purple-50 p-3">
            <p className="text-xs text-purple-600">Received</p>
            <p className="text-xl font-bold text-purple-800">{data.summary.received}</p>
          </div>
          <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-xs text-yellow-600">Pending</p>
            <p className="text-xl font-bold text-yellow-800">{data.summary.pending}</p>
          </div>
          <div className="rounded border border-green-200 bg-green-50 p-3">
            <p className="text-xs text-green-600">Confirmed</p>
            <p className="text-xl font-bold text-green-800">{data.summary.confirmed}</p>
          </div>
          <div className="rounded border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-600">Failed</p>
            <p className="text-xl font-bold text-red-800">{data.summary.failed}</p>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="rounded-lg border border-gray-300 bg-white shadow">
        {data.transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            No transactions found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Hash</th>
                    <th className="px-4 py-3">Listing</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Chain</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span
                          className={`rounded border px-2 py-1 text-xs font-medium ${getTypeColor(tx.type)}`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={getExplorerUrl(tx.hash, tx.sourceChain)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-blue-600 hover:underline"
                        >
                          {truncateAddress(tx.hash)}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        {tx.listing ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={tx.listing.imageUrl}
                              alt={tx.listing.title}
                              className="h-8 w-8 rounded object-cover"
                            />
                            <span className="truncate max-w-[150px]">{tx.listing.title}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {parseFloat(tx.amount).toFixed(2)} {tx.token}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <div>{getChainName(tx.sourceChain)}</div>
                          {tx.nexusRoute && tx.sourceChain !== tx.destinationChain && (
                            <div className="text-gray-500">
                              → {getChainName(tx.destinationChain)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded border px-2 py-1 text-xs font-medium ${getStatusColor(tx.status)}`}
                        >
                          {tx.status}
                        </span>
                        {tx.errorMessage && (
                          <div className="mt-1 text-xs text-red-600" title={tx.errorMessage}>
                            Error
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {formatTimestamp(tx.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-sm text-gray-600">
                Showing {offset + 1} - {Math.min(offset + limit, data.pagination.total)} of{' '}
                {data.pagination.total} transactions
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="rounded border border-gray-300 bg-white px-4 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={!data.pagination.hasMore}
                  className="rounded border border-gray-300 bg-white px-4 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
