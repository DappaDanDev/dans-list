'use client';

import { useState } from 'react';
import { useBlockscout } from './useBlockscout';
import { CHAIN_IDS } from './blockscout.service';

/**
 * Example component demonstrating Blockscout transaction monitoring
 * This shows how to integrate Blockscout monitoring with marketplace transactions
 */
export function TransactionMonitorExample() {
  const [lastTxHash, setLastTxHash] = useState<string>('');
  const {
    monitorTransaction,
    showTransactionHistory,
    getPendingTransactions,
    getTransactionHistory
  } = useBlockscout();

  // Example: Monitor a marketplace listing creation
  const handleCreateListing = async () => {
    try {
      // This would be your actual contract interaction
      // const tx = await marketplace.createListing(...)
      // const hash = tx.hash;

      // For demo, using a mock hash
      const mockHash = `0x${Math.random().toString(16).slice(2, 66)}`;

      console.log('Creating listing with tx hash:', mockHash);

      // Monitor the transaction
      monitorTransaction(mockHash, CHAIN_IDS.ARBITRUM_SEPOLIA);

      setLastTxHash(mockHash);
    } catch (error) {
      console.error('Failed to create listing:', error);
    }
  };

  // Example: Monitor a purchase transaction
  const handlePurchase = async () => {
    try {
      // This would be your actual purchase transaction
      // const tx = await marketplace.purchaseListing(...)
      // const hash = tx.hash;

      const mockHash = `0x${Math.random().toString(16).slice(2, 66)}`;

      console.log('Processing purchase with tx hash:', mockHash);

      // Monitor the transaction
      monitorTransaction(mockHash, CHAIN_IDS.ARBITRUM_SEPOLIA);

      setLastTxHash(mockHash);
    } catch (error) {
      console.error('Failed to process purchase:', error);
    }
  };

  // Show transaction history for current wallet
  const handleShowHistory = () => {
    // In production, you'd get the actual wallet address
    const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5';
    showTransactionHistory(walletAddress);
  };

  // Get current pending transactions
  const pendingTxs = getPendingTransactions();
  const txHistory = getTransactionHistory();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Transaction Monitor Example</h2>

        {/* Action buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={handleCreateListing}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create Listing (Mock)
          </button>

          <button
            onClick={handlePurchase}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Purchase Item (Mock)
          </button>

          <button
            onClick={handleShowHistory}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Show Transaction History
          </button>
        </div>

        {/* Last transaction */}
        {lastTxHash && (
          <div className="mb-4 p-4 bg-gray-100 rounded">
            <p className="text-sm font-mono">
              Last Transaction: {lastTxHash.slice(0, 10)}...{lastTxHash.slice(-8)}
            </p>
          </div>
        )}

        {/* Pending transactions */}
        {pendingTxs.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Pending Transactions</h3>
            <div className="space-y-2">
              {pendingTxs.map((tx) => (
                <div key={tx.hash} className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm">
                    <span className="font-semibold">Hash:</span> {tx.hash.slice(0, 10)}...
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Chain:</span> {tx.chainId}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Status:</span> {tx.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction history */}
        {txHistory.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Recent Transactions</h3>
            <div className="space-y-2">
              {txHistory.slice(0, 5).map((tx) => (
                <div
                  key={tx.hash}
                  className={`p-3 border rounded ${
                    tx.status === 'confirmed'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <p className="text-sm">
                    <span className="font-semibold">Hash:</span> {tx.hash.slice(0, 10)}...
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Status:</span> {tx.status}
                  </p>
                  {tx.blockNumber && (
                    <p className="text-sm">
                      <span className="font-semibold">Block:</span> {tx.blockNumber}
                    </p>
                  )}
                  {tx.gasUsed && (
                    <p className="text-sm">
                      <span className="font-semibold">Gas Used:</span> {tx.gasUsed.toString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionMonitorExample;