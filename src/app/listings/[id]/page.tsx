/**
 * Listing Detail Page
 *
 * Displays full listing details with purchase functionality
 * Integrates AgentPurchasePanel for autonomous purchases
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AgentPurchasePanel, type ListingItem } from '@/app/components/AgentPurchasePanel';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';

/**
 * Listing Detail Page Component
 */
export default function ListingDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [listing, setListing] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListing() {
      try {
        const response = await fetch(`/api/listings/${id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch listing');
        }

        const data = await response.json();
        setListing(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load listing');
      } finally {
        setIsLoading(false);
      }
    }

    fetchListing();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Listing Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'The listing you are looking for does not exist.'}</p>
            <Link href="/listings">
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Back to Listings
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Transform to ListingItem format for AgentPurchasePanel
  const listingItem: ListingItem = {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    sellerAddress: listing.sellerAgent.walletAddress,
    description: listing.description,
    imageUrl: listing.imageUrl,
    destinationChain: 421614, // Arbitrum Sepolia (default)
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumbs */}
        <nav className="mb-6 text-sm">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Home
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <Link href="/listings" className="text-blue-600 hover:text-blue-800">
            Listings
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-600">{listing.title}</span>
        </nav>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Image & Details */}
          <div className="space-y-6">
            {/* Image */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {listing.imageUrl ? (
                <img
                  src={listing.imageUrl}
                  alt={listing.title}
                  className="w-full h-96 object-cover"
                />
              ) : (
                <div className="w-full h-96 bg-gray-200 flex items-center justify-center">
                  <span className="text-9xl">📦</span>
                </div>
              )}
            </div>

            {/* Details Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {listing.title}
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">
                    Description
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {listing.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Category
                    </h3>
                    <p className="text-gray-900">{listing.category}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Condition
                    </h3>
                    <p className="text-gray-900">{listing.condition}</p>
                  </div>
                </div>

                {listing.sellerAgent && (
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Seller Information
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Wallet Address</p>
                      <p className="text-sm font-mono text-gray-900 break-all">
                        {listing.sellerAgent.walletAddress}
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Listings</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {listing.sellerAgent.totalListings}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Purchases</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {listing.sellerAgent.totalPurchases}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Success Rate</p>
                          <p className="text-sm font-semibold text-green-600">
                            {listing.sellerAgent.successRate}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Purchase Panel */}
          <div>
            <AgentPurchasePanel
              listing={listingItem}
              onPurchaseComplete={(result) => {
                console.log('Purchase completed:', result);
                // In a real app, you might want to show a success toast
                // or redirect to a success page
              }}
              onPurchaseError={(error) => {
                console.error('Purchase failed:', error);
                // In a real app, you might want to show an error toast
              }}
            />
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            How Autonomous Purchasing Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">1️⃣</span>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">
                  Connect Vincent Wallet
                </h4>
                <p className="text-sm text-blue-800">
                  One-time setup. Your PKP wallet signs all transactions.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">2️⃣</span>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">
                  PyUSD → USDC Swap
                </h4>
                <p className="text-sm text-blue-800">
                  Automatic swap on ETH Sepolia via Uniswap V3.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-2xl">3️⃣</span>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">
                  Cross-Chain Transfer
                </h4>
                <p className="text-sm text-blue-800">
                  Nexus handles transfer to seller on Arbitrum Sepolia.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <Link
            href="/listings"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <span className="mr-2">←</span>
            Back to All Listings
          </Link>
        </div>
      </div>
    </div>
  );
}
