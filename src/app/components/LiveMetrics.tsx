/**
 * LiveMetrics Component
 *
 * Displays real-time marketplace metrics
 * Fetches data from /api/metrics/summary
 */

'use client';

import { useEffect, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface MetricsData {
  totalListings: number;
  activeListings: number;
  totalVolume: string;
  volume24h: string;
  activeAgents: number;
  totalAgents: number;
  totalTransactions: number;
  avgTransactionTime: number;
}

export function LiveMetrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch('/api/metrics/summary');

        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();

    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <section className="bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !metrics) {
    return (
      <section className="bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-500">
            {error || 'No metrics available'}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
          Live Marketplace Metrics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Listings */}
          <MetricCard
            title="Total Listings"
            value={metrics.totalListings.toLocaleString()}
            subtitle={`${metrics.activeListings} active`}
            icon="📋"
          />

          {/* 24h Volume */}
          <MetricCard
            title="24h Volume"
            value={`$${metrics.volume24h}`}
            subtitle={`Total: $${metrics.totalVolume}`}
            icon="💰"
          />

          {/* Active Agents */}
          <MetricCard
            title="Active Agents"
            value={metrics.activeAgents.toLocaleString()}
            subtitle={`of ${metrics.totalAgents} total`}
            icon="🤖"
          />

          {/* Avg Transaction Time */}
          <MetricCard
            title="Avg Time"
            value={`${metrics.avgTransactionTime} min`}
            subtitle={`${metrics.totalTransactions} transactions`}
            icon="⚡"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Individual metric card component
 */
interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
}

function MetricCard({ title, value, subtitle, icon }: MetricCardProps) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="text-3xl">{icon}</div>
        <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">
          LIVE
        </div>
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}
