'use client';

import { useEffect, useState, useCallback } from 'react';
import { executeQuery } from '@/lib/graphql/client';
import {
  MARKET_METRICS_QUERY,
  TOP_AGENTS_QUERY,
  RECENT_TRANSACTIONS_QUERY,
  type MarketMetricsQueryResult,
  type TopAgentsQueryResult,
  type RecentTransactionsQueryResult,
} from '@/lib/graphql/queries';
import { getLogger } from '@/lib/utils/logger';

const logger = getLogger('components:MarketActivityDashboard');

interface DashboardData {
  metrics: MarketMetricsQueryResult['marketMetrics'];
  topAgents: TopAgentsQueryResult['agents'];
  recentListings: RecentTransactionsQueryResult['listingEvents'];
  recentPurchases: RecentTransactionsQueryResult['purchaseEvents'];
}

export function MarketActivityDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  /**
   * Fetch dashboard data from GraphQL
   */
  const fetchDashboardData = useCallback(async () => {
    try {
      logger.info('Fetching dashboard data');

      // Execute queries in parallel
      const [metricsResult, agentsResult, transactionsResult] = await Promise.all([
        executeQuery<MarketMetricsQueryResult>(MARKET_METRICS_QUERY),
        executeQuery<TopAgentsQueryResult>(TOP_AGENTS_QUERY, {
          first: 10,
          orderBy: 'totalVolume',
        }),
        executeQuery<RecentTransactionsQueryResult>(RECENT_TRANSACTIONS_QUERY, {
          first: 20,
        }),
      ]);

      setData({
        metrics: metricsResult.marketMetrics,
        topAgents: agentsResult.agents,
        recentListings: transactionsResult.listingEvents,
        recentPurchases: transactionsResult.purchaseEvents,
      });

      setLastUpdate(new Date());
      setError(null);
      logger.info('Dashboard data fetched successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to fetch dashboard data');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Setup polling for real-time updates (fallback when WebSocket unavailable)
   */
  useEffect(() => {
    fetchDashboardData();

    if (!isPolling) return;

    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [fetchDashboardData, isPolling]);

  /**
   * Format BigInt values for display (safe for large values)
   * Uses string math to avoid Number() overflow
   */
  const formatVolume = (volume: string): string => {
    try {
      const volumeBigInt = BigInt(volume);
      // Divide by 10^18 using BigInt to avoid overflow
      const ethWhole = volumeBigInt / BigInt(1e18);
      const ethRemainder = volumeBigInt % BigInt(1e18);
      // Format with 4 decimal places
      const decimal = ethRemainder.toString().padStart(18, '0').slice(0, 4);
      return `${ethWhole}.${decimal}`;
    } catch {
      return '0.0000';
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(Number(timestamp) * 1000);
      return date.toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  /**
   * Truncate address for display
   */
  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-500 bg-red-50 p-4">
        <h3 className="font-semibold text-red-800">Error Loading Dashboard</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => fetchDashboardData()}
          className="mt-2 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Market Activity Dashboard</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPolling(!isPolling)}
            className={`rounded px-4 py-2 ${isPolling ? 'bg-green-600' : 'bg-gray-600'} text-white`}
          >
            {isPolling ? 'Polling Active' : 'Polling Paused'}
          </button>
          {lastUpdate && (
            <span className="text-sm text-gray-600">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Market Metrics */}
      {data?.metrics && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow">
            <h3 className="text-sm font-medium text-gray-600">Total Listings</h3>
            <p className="text-2xl font-bold">{data.metrics.totalListings}</p>
          </div>
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow">
            <h3 className="text-sm font-medium text-gray-600">Total Volume</h3>
            <p className="text-2xl font-bold">{formatVolume(data.metrics.totalVolume)} ETH</p>
          </div>
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow">
            <h3 className="text-sm font-medium text-gray-600">Active Agents (24h)</h3>
            <p className="text-2xl font-bold">{data.metrics.activeAgents24h}</p>
          </div>
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow">
            <h3 className="text-sm font-medium text-gray-600">Total Transactions</h3>
            <p className="text-2xl font-bold">{data.metrics.totalTransactions}</p>
          </div>
        </div>
      )}

      {/* Top Agents */}
      {data?.topAgents && data.topAgents.length > 0 && (
        <div className="rounded-lg border border-gray-300 bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Top Performing Agents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2">Agent</th>
                  <th className="pb-2">Listings</th>
                  <th className="pb-2">Purchases</th>
                  <th className="pb-2">Total Volume</th>
                </tr>
              </thead>
              <tbody>
                {data.topAgents.map((agent) => (
                  <tr key={agent.id} className="border-b border-gray-100">
                    <td className="py-2 font-mono text-sm">
                      {truncateAddress(agent.walletAddress)}
                    </td>
                    <td className="py-2">{agent.totalListings}</td>
                    <td className="py-2">{agent.totalPurchases}</td>
                    <td className="py-2">{formatVolume(agent.totalVolume)} ETH</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Listings */}
        {data?.recentListings && data.recentListings.length > 0 && (
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold">Recent Listings</h2>
            <div className="space-y-3">
              {data.recentListings.slice(0, 5).map((listing) => (
                <div
                  key={listing.id}
                  className="rounded border border-gray-200 p-3"
                >
                  <div className="flex justify-between">
                    <span className="font-mono text-sm">
                      {truncateAddress(listing.seller)}
                    </span>
                    <span className="font-semibold">
                      {formatVolume(listing.price)} ETH
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {formatTimestamp(listing.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Purchases */}
        {data?.recentPurchases && data.recentPurchases.length > 0 && (
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold">Recent Purchases</h2>
            <div className="space-y-3">
              {data.recentPurchases.slice(0, 5).map((purchase) => (
                <div
                  key={purchase.id}
                  className="rounded border border-gray-200 p-3"
                >
                  <div className="flex justify-between">
                    <span className="font-mono text-sm">
                      {truncateAddress(purchase.buyer)} →{' '}
                      {truncateAddress(purchase.seller)}
                    </span>
                    <span className="font-semibold">
                      {formatVolume(purchase.amount)} ETH
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {formatTimestamp(purchase.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
