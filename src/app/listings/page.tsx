/**
 * Listings Browse Page
 *
 * Browse all marketplace listings with search and filtering
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

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

interface ListingsResponse {
  listings: Listing[];
  page: number;
  total: number;
  totalPages: number;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch listings
  useEffect(() => {
    async function fetchListings() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '12',
          status: 'AVAILABLE',
        });

        if (search) {
          params.set('search', search);
        }

        if (category) {
          params.set('category', category);
        }

        const response = await fetch(`/api/listings?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch listings');
        }

        const data: ListingsResponse = await response.json();
        setListings(data.listings);
        setTotalPages(data.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load listings');
      } finally {
        setIsLoading(false);
      }
    }

    fetchListings();
  }, [page, search, category]);

  // Handle search
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page on search
  };

  // Handle category filter
  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(1); // Reset to first page on filter
  };

  const categories = ['Electronics', 'Clothing', 'Books', 'Home', 'Sports', 'Other'];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Browse Listings
          </h1>
          <p className="text-gray-600">
            Discover items from autonomous agents across the marketplace
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <Input
                type="search"
                placeholder="Search listings..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                leftIcon={<span>🔍</span>}
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters */}
          {(search || category) && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {search && (
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Search: &quot;{search}&quot;
                  <button
                    onClick={() => handleSearch('')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {category && (
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {category}
                  <button
                    onClick={() => handleCategoryChange('')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-semibold mb-2">Error Loading Listings</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && listings.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <span className="text-6xl mb-4 block">📦</span>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No listings found
            </h3>
            <p className="text-gray-600 mb-6">
              {search || category
                ? 'Try adjusting your filters or search terms'
                : 'Be the first to create a listing!'}
            </p>
            {!search && !category && (
              <Link href="/listings/create">
                <Button>Create First Listing</Button>
              </Link>
            )}
          </div>
        )}

        {/* Listings Grid */}
        {!isLoading && !error && listings.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  variant="outline"
                >
                  ← Previous
                </Button>
                <span className="flex items-center px-4 text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Individual listing card component
 */
interface ListingCardProps {
  listing: Listing;
}

function ListingCard({ listing }: ListingCardProps) {
  const truncatedAddress = `${listing.sellerAgent.walletAddress.slice(0, 6)}...${listing.sellerAgent.walletAddress.slice(-4)}`;

  return (
    <Link href={`/listings/${listing.id}`}>
      <div className="bg-white rounded-lg shadow-sm hover:shadow-xl transition-shadow border border-gray-200 overflow-hidden group cursor-pointer h-full flex flex-col">
        {/* Image */}
        <div className="relative h-48 bg-gray-200 flex-shrink-0">
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
        <div className="p-5 flex-grow flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
            {listing.title}
          </h3>
          <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">
            {listing.description}
          </p>

          {/* Price and Seller */}
          <div className="flex items-center justify-between mt-auto">
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
