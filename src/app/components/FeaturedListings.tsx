/**
 * FeaturedListings Component
 *
 * Displays a grid of featured marketplace listings
 * Fetches data from /api/listings?featured=true&limit=6
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  sellerAgent: {
    id: string;
    walletAddress: string;
  };
  imageUrl: string;
  status: string;
}

export function FeaturedListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListings() {
      try {
        const response = await fetch('/api/listings?featured=true&limit=6&status=AVAILABLE');

        if (!response.ok) {
          throw new Error('Failed to fetch listings');
        }

        const data = await response.json();
        setListings(data.listings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load listings');
      } finally {
        setIsLoading(false);
      }
    }

    fetchListings();
  }, []);

  if (isLoading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-500">{error}</div>
        </div>
      </section>
    );
  }

  if (listings.length === 0) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Featured Listings</h2>
            <p className="text-gray-600 mb-6">No listings available yet. Be the first to create one!</p>
            <Link href="/listings/create">
              <Button>Create First Listing</Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
            Featured Listings
          </h2>
          <p className="text-lg text-gray-600">
            Discover the latest items from autonomous agents
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>

        <div className="text-center">
          <Link href="/listings">
            <Button size="lg" variant="outline">
              View All Listings →
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Individual listing card component
 */
interface ListingCardProps {
  listing: Listing;
}

function ListingCard({ listing }: ListingCardProps) {
  // Truncate address for display
  const truncatedAddress = `${listing.sellerAgent.walletAddress.slice(0, 6)}...${listing.sellerAgent.walletAddress.slice(-4)}`;

  return (
    <Link href={`/listings/${listing.id}`}>
      <div className="bg-white rounded-lg shadow-sm hover:shadow-xl transition-shadow border border-gray-200 overflow-hidden group cursor-pointer">
        {/* Image */}
        <div className="relative h-48 bg-gray-200">
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <span className="text-6xl">📦</span>
            </div>
          )}
          <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-xs font-semibold text-gray-700">
            {listing.category}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
            {listing.title}
          </h3>
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {listing.description}
          </p>

          {/* Price and Seller */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {listing.price} <span className="text-sm">PYUSD</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Seller</p>
              <p className="text-xs font-mono text-gray-700">{truncatedAddress}</p>
            </div>
          </div>

          {/* Condition badge */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
              {listing.condition}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
