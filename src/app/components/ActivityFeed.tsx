'use client';

import { useEffect, useState } from 'react';
import { getAnalyticsService, type MarketEvent } from '@/lib/analytics/hypersync.service';
import { getLogger } from '@/lib/utils/logger';

const logger = getLogger('components:ActivityFeed');

interface ActivityFeedProps {
  /**
   * Maximum number of events to display
   */
  maxEvents?: number;

  /**
   * Whether to auto-scroll to new events
   */
  autoScroll?: boolean;

  /**
   * Custom className for styling
   */
  className?: string;
}

export function ActivityFeed({
  maxEvents = 50,
  autoScroll = true,
  className = '',
}: ActivityFeedProps) {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const analyticsService = getAnalyticsService();

    const initializeStream = async () => {
      try {
        logger.info('Initializing activity feed stream');

        // Start streaming market events
        unsubscribe = await analyticsService.streamMarketEvents((event) => {
          logger.debug({ event }, 'New market event received');

          setEvents((prevEvents) => {
            // Add new event to the beginning
            const updated = [event, ...prevEvents];
            // Limit to maxEvents
            return updated.slice(0, maxEvents);
          });

          // Auto-scroll to top if enabled
          if (autoScroll) {
            const container = document.getElementById('activity-feed-container');
            if (container) {
              container.scrollTop = 0;
            }
          }
        });

        setIsConnected(true);
        setLoading(false);
        setError(null);

        logger.info('Activity feed stream initialized successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ error: errorMessage }, 'Failed to initialize activity feed stream');
        setError(errorMessage);
        setLoading(false);
        setIsConnected(false);
      }
    };

    initializeStream();

    // Cleanup on unmount
    return () => {
      if (unsubscribe) {
        logger.info('Cleaning up activity feed stream');
        unsubscribe();
      }
    };
  }, [maxEvents, autoScroll]);

  /**
   * Format event type for display
   */
  const formatEventType = (type: string): string => {
    return type.replace(/([A-Z])/g, ' $1').trim();
  };

  /**
   * Format price/amount for display
   */
  const formatAmount = (amount: bigint): string => {
    try {
      const ethWhole = amount / BigInt(1e18);
      const ethRemainder = amount % BigInt(1e18);
      const decimal = ethRemainder.toString().padStart(18, '0').slice(0, 4);
      return `${ethWhole}.${decimal} ETH`;
    } catch {
      return '0.0000 ETH';
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const eventTime = timestamp * 1000;
    const diffSeconds = Math.floor((now - eventTime) / 1000);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffSeconds < 3600) {
      const mins = Math.floor(diffSeconds / 60);
      return `${mins}m ago`;
    } else if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours}h ago`;
    } else {
      return new Date(eventTime).toLocaleDateString();
    }
  };

  /**
   * Truncate address for display
   */
  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  /**
   * Get event icon/color based on type
   */
  const getEventStyle = (type: string) => {
    switch (type) {
      case 'ListingCreated':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          icon: '📝',
        };
      case 'ListingPurchased':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          icon: '💳',
        };
      case 'MarketplaceFeeUpdated':
        return {
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          textColor: 'text-purple-800',
          icon: '⚙️',
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          icon: '📊',
        };
    }
  };

  if (loading) {
    return (
      <div className={`rounded-lg border border-gray-300 bg-white p-6 shadow ${className}`}>
        <h2 className="mb-4 text-xl font-bold">Live Activity Feed</h2>
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-sm text-gray-600">Connecting to activity stream...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-300 bg-red-50 p-6 shadow ${className}`}>
        <h2 className="mb-4 text-xl font-bold text-red-800">Activity Feed Error</h2>
        <p className="mb-4 text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-300 bg-white p-6 shadow ${className}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Live Activity Feed</h2>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
          ></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Events List */}
      <div
        id="activity-feed-container"
        className="max-h-[600px] space-y-3 overflow-y-auto pr-2"
        role="feed"
        aria-label="Live market activity feed"
        aria-live="polite"
      >
        {events.length === 0 ? (
          <div className="rounded border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-gray-600">No activity yet. Listening for new events...</p>
          </div>
        ) : (
          events.map((event, index) => {
            const style = getEventStyle(event.type);

            return (
              <div
                key={`${event.transactionHash}-${index}`}
                className={`rounded border ${style.borderColor} ${style.bgColor} p-4 transition-all hover:shadow-md`}
                role="article"
                aria-label={`${formatEventType(event.type)} event`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{style.icon}</span>
                    <div>
                      <h3 className={`font-semibold ${style.textColor}`}>
                        {formatEventType(event.type)}
                      </h3>

                      {/* Event Details */}
                      <div className="mt-1 space-y-1 text-sm text-gray-700">
                        {event.listingId && (
                          <p>
                            Listing: <span className="font-mono">{event.listingId}</span>
                          </p>
                        )}

                        {event.seller && (
                          <p>
                            Seller: <span className="font-mono">{truncateAddress(event.seller)}</span>
                          </p>
                        )}

                        {event.buyer && (
                          <p>
                            Buyer: <span className="font-mono">{truncateAddress(event.buyer)}</span>
                          </p>
                        )}

                        {event.price && (
                          <p className="font-semibold">{formatAmount(event.price)}</p>
                        )}
                      </div>

                      {/* Transaction Hash */}
                      <a
                        href={`https://etherscan.io/tx/${event.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                      >
                        {truncateAddress(event.transactionHash)} ↗
                      </a>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Stats */}
      {events.length > 0 && (
        <div className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-600">
          <p>
            Showing {events.length} {events.length === 1 ? 'event' : 'events'}
            {events.length === maxEvents && ' (max reached)'}
          </p>
        </div>
      )}
    </div>
  );
}
