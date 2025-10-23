'use client';

import { useEffect, useState, useCallback } from 'react';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;

interface AgentData {
  agent: {
    id: string;
    type: string;
    walletAddress: string;
    totalTransactions: number;
    successRate: number | null;
    totalVolume: string;
    lastActivity: Date | null;
    createdAt: Date;
  };
  recentListings: Array<{
    id: string;
    title: string;
    price: number;
    status: string;
    createdAt: Date;
  }>;
  recentTransactions: Array<{
    id: string;
    hash: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>;
}

interface AgentDashboardProps {
  agentId: string;
  refreshInterval?: number; // in milliseconds
}

export function AgentDashboard({ agentId, refreshInterval }: AgentDashboardProps) {
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgentData = useCallback(async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch agent data: ${response.statusText}`);
      }

      const agentData = await response.json();
      setData(agentData);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ error: errorMessage, agentId }, 'Failed to fetch agent data');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchAgentData();

    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(fetchAgentData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchAgentData, refreshInterval]);

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

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading agent dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading agent data</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const { agent, recentListings, recentTransactions } = data;

  return (
    <div className="space-y-6">
      {/* Agent Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Agent Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Type</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{agent.type}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Wallet Address</p>
            <p className="mt-1 text-lg font-mono text-gray-900">
              {truncateAddress(agent.walletAddress)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Transactions</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {agent.totalTransactions}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Success Rate</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {agent.successRate !== null ? `${(agent.successRate * 100).toFixed(1)}%` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Volume</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatVolume(agent.totalVolume)} ETH
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Created</p>
            <p className="mt-1 text-sm text-gray-900">{formatDate(agent.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Recent Listings */}
      {recentListings.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Listings</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentListings.map((listing) => (
                  <tr key={listing.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {listing.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${listing.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          listing.status === 'AVAILABLE'
                            ? 'bg-green-100 text-green-800'
                            : listing.status === 'SOLD'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {listing.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(listing.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hash
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {truncateAddress(tx.hash)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${tx.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          tx.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : tx.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(tx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentListings.length === 0 && recentTransactions.length === 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-8">
            <p className="text-gray-500">No recent activity for this agent</p>
          </div>
        </div>
      )}
    </div>
  );
}
