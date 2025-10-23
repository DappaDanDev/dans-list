/**
 * Agent Purchase Panel
 *
 * Integrates Vincent authentication with agent purchase flow
 * Allows autonomous agents to purchase listings using PyUSD → USDC → Cross-chain transfer
 */

'use client';

import { useState } from 'react';
import { VincentConnect } from './VincentConnect';

/**
 * Listing item for purchase
 */
export interface ListingItem {
  id: string;
  title: string;
  price: number; // In PYUSD
  sellerAddress: string;
  description?: string;
  imageUrl?: string;
  destinationChain?: number; // Default: Arbitrum Sepolia
}

/**
 * Component props
 */
interface AgentPurchasePanelProps {
  listing: ListingItem;
  agentId?: string;
  onPurchaseComplete?: (result: PurchaseResult) => void;
  onPurchaseError?: (error: Error) => void;
}

/**
 * Purchase result
 */
interface PurchaseResult {
  success: boolean;
  swapTxHash?: string;
  transferExplorerUrl?: string;
  usdcAmount?: string;
}

/**
 * AgentPurchasePanel Component
 */
export function AgentPurchasePanel({
  listing,
  agentId,
  onPurchaseComplete,
  onPurchaseError,
}: AgentPurchasePanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  /**
   * Handle Vincent authentication complete
   */
  const handleAuthComplete = (_authJwt: string, address: string) => {
    setIsAuthenticated(true);
    setWalletAddress(address);
  };

  /**
   * Handle authentication error
   */
  const handleAuthError = (error: Error) => {
    console.error('Auth error:', error);
  };

  /**
   * Execute purchase flow
   */
  const handlePurchase = async () => {
    if (!walletAddress) {
      setPurchaseError('Not authenticated');
      return;
    }

    setIsPurchasing(true);
    setPurchaseError(null);
    setPurchaseResult(null);

    try {
      const response = await fetch('/api/agents/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerAgentId: agentId || walletAddress,
          sellerWalletAddress: listing.sellerAddress,
          pyusdAmount: listing.price,
          fromChainId: 11155111, // ETH Sepolia - where PyUSD swap happens
          toChainId: listing.destinationChain || 421614, // Arbitrum Sepolia - default destination
          listingId: listing.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Purchase failed');
      }

      const result: PurchaseResult = {
        success: true,
        swapTxHash: data.swapTxHash,
        transferExplorerUrl: data.transferExplorerUrl,
        usdcAmount: data.usdcAmount,
      };

      setPurchaseResult(result);
      onPurchaseComplete?.(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Purchase failed');
      setPurchaseError(err.message);
      onPurchaseError?.(err);
    } finally {
      setIsPurchasing(false);
    }
  };

  /**
   * Disconnect wallet
   */
  const handleDisconnect = () => {
    setIsAuthenticated(false);
    setWalletAddress(null);
    setPurchaseResult(null);
    setPurchaseError(null);
    localStorage.removeItem('VINCENT_AUTH_JWT');
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-6">
      {/* Listing Info */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{listing.title}</h2>
        {listing.description && (
          <p className="text-gray-600 mb-3">{listing.description}</p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Price</p>
            <p className="text-3xl font-bold text-blue-600">{listing.price} PYUSD</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Seller</p>
            <p className="text-xs font-mono text-gray-700">
              {listing.sellerAddress.slice(0, 6)}...{listing.sellerAddress.slice(-4)}
            </p>
          </div>
        </div>
      </div>

      {/* Authentication Section */}
      {!isAuthenticated ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Connect Vincent Wallet
          </h3>
          <VincentConnect
            onAuthComplete={handleAuthComplete}
            onAuthError={handleAuthError}
            agentId={agentId}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connected Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Connected</p>
                <p className="text-xs font-mono text-green-700 mt-1">
                  {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-6)}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-sm text-green-700 hover:text-green-900 underline"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Purchase Button */}
          {!purchaseResult && (
            <button
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-full px-6 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPurchasing ? 'Processing Purchase...' : `Purchase for ${listing.price} PYUSD`}
            </button>
          )}

          {/* Purchase Progress */}
          {isPurchasing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Processing...</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Step 1: Swapping PyUSD → USDC on ETH Sepolia
                  </p>
                  <p className="text-xs text-blue-700">
                    Step 2: Cross-chain transfer to seller
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Success */}
          {purchaseResult && purchaseResult.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-green-600 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-medium text-green-900">Purchase Successful!</h4>
                  <div className="mt-2 space-y-2 text-xs text-green-800">
                    {purchaseResult.swapTxHash && (
                      <div>
                        <p className="font-semibold">Swap Transaction:</p>
                        <p className="font-mono break-all">{purchaseResult.swapTxHash}</p>
                      </div>
                    )}
                    {purchaseResult.usdcAmount && (
                      <div>
                        <p className="font-semibold">USDC Received:</p>
                        <p>{(parseInt(purchaseResult.usdcAmount) / 1e6).toFixed(2)} USDC</p>
                      </div>
                    )}
                    {purchaseResult.transferExplorerUrl && (
                      <a
                        href={purchaseResult.transferExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-green-700 hover:text-green-900 underline"
                      >
                        View Transfer on Explorer →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Error */}
          {purchaseError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-900">Purchase Failed</h4>
              <p className="mt-1 text-sm text-red-700">{purchaseError}</p>
              <button
                onClick={handlePurchase}
                className="mt-3 text-sm text-red-700 hover:text-red-900 underline"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">How it works</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Connect your Vincent wallet (one-time setup)</li>
          <li>• Your agent automatically swaps PyUSD → USDC on ETH Sepolia</li>
          <li>• Nexus handles cross-chain transfer to seller on Arbitrum Sepolia</li>
          <li>• All transactions signed by your PKP wallet</li>
        </ul>
      </div>
    </div>
  );
}
