/**
 * Tests for ActivityFeed Component
 *
 * Tests loading, empty, error, and high-volume states
 * Includes accessibility testing with jest-axe
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ActivityFeed } from '../ActivityFeed';
import type { MarketEvent } from '@/lib/analytics/hypersync.service';

// Extend Vitest matchers with jest-axe
expect.extend(toHaveNoViolations);

// Mock the analytics service
const mockStreamMarketEvents = vi.fn();
const mockGetAnalyticsService = vi.fn(() => ({
  streamMarketEvents: mockStreamMarketEvents,
}));

vi.mock('@/lib/analytics/hypersync.service', () => ({
  getAnalyticsService: () => mockGetAnalyticsService(),
}));

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('ActivityFeed', () => {
  let unsubscribeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribeMock = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Loading State', () => {
    it('should display loading indicator while connecting', () => {
      // Mock stream that never resolves
      mockStreamMarketEvents.mockImplementation(() => new Promise(() => {}));

      render(<ActivityFeed />);

      expect(screen.getByText(/connecting to activity stream/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /live activity feed/i })).toBeInTheDocument();
    });

    it('should be accessible in loading state', async () => {
      mockStreamMarketEvents.mockImplementation(() => new Promise(() => {}));

      const { container } = render(<ActivityFeed />);
      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });
  });

  describe('Empty State', () => {
    it('should display empty message when no events', async () => {
      mockStreamMarketEvents.mockResolvedValue(unsubscribeMock);

      render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/listening for new events/i)).toBeInTheDocument();
    });

    it('should show connected status', async () => {
      mockStreamMarketEvents.mockResolvedValue(unsubscribeMock);

      render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });
    });

    it('should be accessible in empty state', async () => {
      mockStreamMarketEvents.mockResolvedValue(unsubscribeMock);

      const { container } = render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Error State', () => {
    it('should display error message when stream fails', async () => {
      const errorMessage = 'Connection failed';
      mockStreamMarketEvents.mockRejectedValue(new Error(errorMessage));

      render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/activity feed error/i)).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should be accessible in error state', async () => {
      mockStreamMarketEvents.mockRejectedValue(new Error('Test error'));

      const { container } = render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/activity feed error/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Events Display', () => {
    it('should display listing created events', async () => {
      let callback: ((event: MarketEvent) => void) | null = null;

      mockStreamMarketEvents.mockImplementation((cb) => {
        callback = cb;
        return Promise.resolve(unsubscribeMock);
      });

      render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Simulate incoming event
      const event: MarketEvent = {
        type: 'ListingCreated',
        listingId: 'listing123',
        seller: '0x1234567890123456789012345678901234567890',
        price: 1000000000000000000n, // 1 ETH
        blockNumber: 100n,
        transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        timestamp: Math.floor(Date.now() / 1000) - 30, // 30 seconds ago
        chainId: 31337,
      };

      callback?.(event);

      await waitFor(() => {
        expect(screen.getByText(/listing created/i)).toBeInTheDocument();
        expect(screen.getByText(/listing123/i)).toBeInTheDocument();
      });
    });

    it('should display purchase events', async () => {
      let callback: ((event: MarketEvent) => void) | null = null;

      mockStreamMarketEvents.mockImplementation((cb) => {
        callback = cb;
        return Promise.resolve(unsubscribeMock);
      });

      render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      const event: MarketEvent = {
        type: 'ListingPurchased',
        listingId: 'listing456',
        buyer: '0x1111111111111111111111111111111111111111',
        seller: '0x2222222222222222222222222222222222222222',
        price: 2000000000000000000n, // 2 ETH
        blockNumber: 101n,
        transactionHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        timestamp: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
        chainId: 421614,
      };

      callback?.(event);

      await waitFor(() => {
        expect(screen.getByText(/listing purchased/i)).toBeInTheDocument();
        expect(screen.getByText(/listing456/i)).toBeInTheDocument();
      });
    });

    it('should format amounts correctly', async () => {
      let callback: ((event: MarketEvent) => void) | null = null;

      mockStreamMarketEvents.mockImplementation((cb) => {
        callback = cb;
        return Promise.resolve(unsubscribeMock);
      });

      render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      const event: MarketEvent = {
        type: 'ListingCreated',
        listingId: 'listing789',
        seller: '0x3333333333333333333333333333333333333333',
        price: 1500000000000000000n, // 1.5 ETH
        blockNumber: 102n,
        transactionHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
        timestamp: Math.floor(Date.now() / 1000),
        chainId: 31337,
      };

      callback?.(event);

      await waitFor(() => {
        expect(screen.getByText(/1\.5000 ETH/i)).toBeInTheDocument();
      });
    });

    it('should be accessible with events', async () => {
      let callback: ((event: MarketEvent) => void) | null = null;

      mockStreamMarketEvents.mockImplementation((cb) => {
        callback = cb;
        return Promise.resolve(unsubscribeMock);
      });

      const { container } = render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      const event: MarketEvent = {
        type: 'ListingCreated',
        listingId: 'listing123',
        seller: '0x1234567890123456789012345678901234567890',
        price: 1000000000000000000n,
        blockNumber: 100n,
        transactionHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        timestamp: Math.floor(Date.now() / 1000),
        chainId: 31337,
      };

      callback?.(event);

      await waitFor(() => {
        expect(screen.getByText(/listing created/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('High-Volume State', () => {
    it('should limit events to maxEvents', async () => {
      let callback: ((event: MarketEvent) => void) | null = null;

      mockStreamMarketEvents.mockImplementation((cb) => {
        callback = cb;
        return Promise.resolve(unsubscribeMock);
      });

      const maxEvents = 10;
      render(<ActivityFeed maxEvents={maxEvents} />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Send more events than maxEvents
      for (let i = 0; i < 15; i++) {
        const event: MarketEvent = {
          type: 'ListingCreated',
          listingId: `listing${i}`,
          seller: `0x${i.toString().padStart(40, '0')}`,
          price: BigInt(i * 1000000000000000000),
          blockNumber: BigInt(100 + i),
          transactionHash: `0x${i.toString().padStart(64, '0')}`,
          timestamp: Math.floor(Date.now() / 1000) - i,
          chainId: 31337,
        };

        callback?.(event);
      }

      await waitFor(() => {
        expect(screen.getByText(`Showing ${maxEvents} events (max reached)`)).toBeInTheDocument();
      });

      // Verify we don't show more than maxEvents
      const eventArticles = screen.getAllByRole('article');
      expect(eventArticles.length).toBe(maxEvents);
    });

    it('should show most recent events first', async () => {
      let callback: ((event: MarketEvent) => void) | null = null;

      mockStreamMarketEvents.mockImplementation((cb) => {
        callback = cb;
        return Promise.resolve(unsubscribeMock);
      });

      render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Send events in order
      const events = ['first', 'second', 'third'].map((id, i) => ({
        type: 'ListingCreated' as const,
        listingId: id,
        seller: `0x${i.toString().padStart(40, '0')}`,
        price: BigInt(i * 1000000000000000000),
        blockNumber: BigInt(100 + i),
        transactionHash: `0x${i.toString().padStart(64, '0')}`,
        timestamp: Math.floor(Date.now() / 1000) + i,
        chainId: 31337,
      }));

      for (const event of events) {
        callback?.(event);
      }

      await waitFor(() => {
        expect(screen.getByText(/third/i)).toBeInTheDocument();
      });

      // Most recent (third) should be first in the list
      const listingIds = screen.getAllByText(/listing/i);
      expect(listingIds[0]?.textContent).toContain('third');
    });

    it('should handle rapid event updates', async () => {
      let callback: ((event: MarketEvent) => void) | null = null;

      mockStreamMarketEvents.mockImplementation((cb) => {
        callback = cb;
        return Promise.resolve(unsubscribeMock);
      });

      render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Send events rapidly
      const rapidEvents = Array(5)
        .fill(null)
        .map((_, i) => ({
          type: 'ListingPurchased' as const,
          listingId: `rapid${i}`,
          buyer: `0x${i.toString().padStart(40, 'a')}`,
          seller: `0x${i.toString().padStart(40, 'b')}`,
          price: BigInt(i * 1000000000000000000),
          blockNumber: BigInt(200 + i),
          transactionHash: `0x${i.toString().padStart(64, '1')}`,
          timestamp: Math.floor(Date.now() / 1000),
          chainId: 421614,
        }));

      rapidEvents.forEach((event) => callback?.(event));

      await waitFor(() => {
        expect(screen.getByText(/showing 5 events/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe on unmount', async () => {
      mockStreamMarketEvents.mockResolvedValue(unsubscribeMock);

      const { unmount } = render(<ActivityFeed />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Customization', () => {
    it('should apply custom className', async () => {
      mockStreamMarketEvents.mockResolvedValue(unsubscribeMock);

      const { container } = render(<ActivityFeed className="custom-class" />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('should respect maxEvents prop', async () => {
      let callback: ((event: MarketEvent) => void) | null = null;

      mockStreamMarketEvents.mockImplementation((cb) => {
        callback = cb;
        return Promise.resolve(unsubscribeMock);
      });

      render(<ActivityFeed maxEvents={3} />);

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });

      // Add 5 events
      for (let i = 0; i < 5; i++) {
        callback?.({
          type: 'ListingCreated',
          listingId: `test${i}`,
          seller: `0x${i.toString().padStart(40, '0')}`,
          price: BigInt(i),
          blockNumber: BigInt(i),
          transactionHash: `0x${i.toString().padStart(64, '0')}`,
          timestamp: Math.floor(Date.now() / 1000),
          chainId: 31337,
        });
      }

      await waitFor(() => {
        const articles = screen.getAllByRole('article');
        expect(articles.length).toBe(3);
      });
    });
  });
});
