import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BlockscoutMonitoringService,
  CHAIN_IDS,
  type TransactionStatus,
  type TransactionEvent,
} from '../blockscout.service';
import type { TransactionReceipt } from 'viem';

describe('BlockscoutMonitoringService', () => {
  let service: BlockscoutMonitoringService;

  beforeEach(() => {
    service = new BlockscoutMonitoringService();
    // Mock console.log to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Transaction Tracking', () => {
    it('should track a new transaction', () => {
      const hash = '0x123abc';
      const chainId = CHAIN_IDS.ARBITRUM_SEPOLIA;

      service.trackTransaction(hash, chainId);

      const pendingTxs = service.getPendingTransactions();
      expect(pendingTxs).toHaveLength(1);
      expect(pendingTxs[0]).toMatchObject({
        hash,
        chainId,
        status: 'pending',
      });
      expect(pendingTxs[0]?.timestamp).toBeDefined();
    });

    it('should track multiple transactions', () => {
      const tx1 = { hash: '0x111', chainId: CHAIN_IDS.ETHEREUM_MAINNET };
      const tx2 = { hash: '0x222', chainId: CHAIN_IDS.ARBITRUM_ONE };
      const tx3 = { hash: '0x333', chainId: CHAIN_IDS.POLYGON };

      service.trackTransaction(tx1.hash, tx1.chainId);
      service.trackTransaction(tx2.hash, tx2.chainId);
      service.trackTransaction(tx3.hash, tx3.chainId);

      const pendingTxs = service.getPendingTransactions();
      expect(pendingTxs).toHaveLength(3);
    });
  });

  describe('Transaction Status Updates', () => {
    it('should update transaction status to confirmed', () => {
      const hash = '0x456def';
      const chainId = CHAIN_IDS.ARBITRUM_SEPOLIA;

      service.trackTransaction(hash, chainId);

      const receipt: TransactionReceipt = {
        blockHash: '0xblock123',
        blockNumber: 12345678n,
        contractAddress: null,
        cumulativeGasUsed: 100000n,
        effectiveGasPrice: 1000000000n,
        from: '0xfrom',
        gasUsed: 21000n,
        logs: [],
        logsBloom: '0x',
        status: 'success',
        to: '0xto',
        transactionHash: hash,
        transactionIndex: 0,
        type: 'eip1559',
        root: undefined,
      };

      service.updateTransactionStatus(hash, receipt);

      // Check it's no longer pending
      const pendingTxs = service.getPendingTransactions();
      expect(pendingTxs).toHaveLength(0);

      // Check it's in history
      const history = service.getTransactionHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        hash,
        chainId,
        status: 'confirmed',
        blockNumber: 12345678,
        gasUsed: 21000n,
      });
    });

    it('should update transaction status to failed', () => {
      const hash = '0x789ghi';
      const chainId = CHAIN_IDS.BASE;

      service.trackTransaction(hash, chainId);

      const receipt: TransactionReceipt = {
        blockHash: '0xblock456',
        blockNumber: 87654321n,
        contractAddress: null,
        cumulativeGasUsed: 200000n,
        effectiveGasPrice: 2000000000n,
        from: '0xfrom',
        gasUsed: 50000n,
        logs: [],
        logsBloom: '0x',
        status: 'reverted',
        to: '0xto',
        transactionHash: hash,
        transactionIndex: 1,
        type: 'legacy',
        root: undefined,
      };

      service.updateTransactionStatus(hash, receipt);

      const history = service.getTransactionHistory();
      expect(history[0]?.status).toBe('failed');
    });
  });

  describe('Transaction History', () => {
    it('should maintain transaction history in order', () => {
      // Track and confirm multiple transactions
      for (let i = 1; i <= 5; i++) {
        const hash = `0x${i}`;
        service.trackTransaction(hash, CHAIN_IDS.ARBITRUM_SEPOLIA);

        const receipt: TransactionReceipt = {
          blockHash: `0xblock${i}`,
          blockNumber: BigInt(i * 1000),
          contractAddress: null,
          cumulativeGasUsed: 100000n,
          effectiveGasPrice: 1000000000n,
          from: '0xfrom',
          gasUsed: 21000n,
          logs: [],
          logsBloom: '0x',
          status: 'success',
          to: '0xto',
          transactionHash: hash,
          transactionIndex: 0,
          type: 'eip1559',
          root: undefined,
        };

        service.updateTransactionStatus(hash, receipt);
      }

      const history = service.getTransactionHistory();
      expect(history).toHaveLength(5);
      // Most recent should be first
      expect(history[0]?.hash).toBe('0x5');
      expect(history[4]?.hash).toBe('0x1');
    });

    it('should limit history size to maxHistorySize', () => {
      // Track more than max history size (100)
      for (let i = 1; i <= 105; i++) {
        const hash = `0x${i}`;
        service.trackTransaction(hash, CHAIN_IDS.ARBITRUM_SEPOLIA);

        const receipt: TransactionReceipt = {
          blockHash: `0xblock${i}`,
          blockNumber: BigInt(i),
          contractAddress: null,
          cumulativeGasUsed: 100000n,
          effectiveGasPrice: 1000000000n,
          from: '0xfrom',
          gasUsed: 21000n,
          logs: [],
          logsBloom: '0x',
          status: 'success',
          to: '0xto',
          transactionHash: hash,
          transactionIndex: 0,
          type: 'eip1559',
          root: undefined,
        };

        service.updateTransactionStatus(hash, receipt);
      }

      const history = service.getTransactionHistory();
      expect(history).toHaveLength(100); // Should be capped at 100
      expect(history[0]?.hash).toBe('0x105'); // Most recent
      expect(history[99]?.hash).toBe('0x6'); // Oldest (first 5 dropped)
    });
  });

  describe('Transaction Retrieval', () => {
    it('should get transaction by hash from pending', () => {
      const hash = '0xabc123';
      const chainId = CHAIN_IDS.OPTIMISM;

      service.trackTransaction(hash, chainId);

      const transaction = service.getTransaction(hash);
      expect(transaction).toBeDefined();
      expect(transaction?.hash).toBe(hash);
      expect(transaction?.status).toBe('pending');
    });

    it('should get transaction by hash from history', () => {
      const hash = '0xdef456';
      const chainId = CHAIN_IDS.POLYGON;

      service.trackTransaction(hash, chainId);

      const receipt: TransactionReceipt = {
        blockHash: '0xblock',
        blockNumber: 999999n,
        contractAddress: null,
        cumulativeGasUsed: 100000n,
        effectiveGasPrice: 1000000000n,
        from: '0xfrom',
        gasUsed: 30000n,
        logs: [],
        logsBloom: '0x',
        status: 'success',
        to: '0xto',
        transactionHash: hash,
        transactionIndex: 0,
        type: 'eip1559',
        root: undefined,
      };

      service.updateTransactionStatus(hash, receipt);

      const transaction = service.getTransaction(hash);
      expect(transaction).toBeDefined();
      expect(transaction?.hash).toBe(hash);
      expect(transaction?.status).toBe('confirmed');
      expect(transaction?.gasUsed).toBe(30000n);
    });

    it('should return undefined for unknown transaction', () => {
      const transaction = service.getTransaction('0xunknown');
      expect(transaction).toBeUndefined();
    });
  });

  describe('Clear Functionality', () => {
    it('should clear all tracking data', () => {
      // Add some data
      service.trackTransaction('0x1', CHAIN_IDS.ETHEREUM_MAINNET);
      service.trackTransaction('0x2', CHAIN_IDS.ARBITRUM_ONE);

      const receipt: TransactionReceipt = {
        blockHash: '0xblock',
        blockNumber: 100n,
        contractAddress: null,
        cumulativeGasUsed: 100000n,
        effectiveGasPrice: 1000000000n,
        from: '0xfrom',
        gasUsed: 21000n,
        logs: [],
        logsBloom: '0x',
        status: 'success',
        to: '0xto',
        transactionHash: '0x1',
        transactionIndex: 0,
        type: 'eip1559',
        root: undefined,
      };

      service.updateTransactionStatus('0x1', receipt);

      // Clear
      service.clear();

      // Verify everything is cleared
      expect(service.getPendingTransactions()).toHaveLength(0);
      expect(service.getTransactionHistory()).toHaveLength(0);
      expect(service.getTransaction('0x1')).toBeUndefined();
      expect(service.getTransaction('0x2')).toBeUndefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit transaction:tracked event when tracking a transaction', () => {
      return new Promise<void>((resolve) => {
        const hash = '0xevent123';
        const chainId = CHAIN_IDS.BASE_SEPOLIA;

        service.once('transaction:tracked', (event: TransactionEvent) => {
          expect(event.type).toBe('transaction:tracked');
          expect(event.transaction.hash).toBe(hash);
          expect(event.transaction.chainId).toBe(chainId);
          expect(event.transaction.status).toBe('pending');
          expect(event.timestamp).toBeDefined();
          resolve();
        });

        service.trackTransaction(hash, chainId);
      });
    });

    it('should emit transaction:pending event when tracking a transaction', () => {
      return new Promise<void>((resolve) => {
        const hash = '0xpending123';
        const chainId = CHAIN_IDS.ARBITRUM_SEPOLIA;

        service.once('transaction:pending', (event: TransactionEvent) => {
          expect(event.type).toBe('transaction:pending');
          expect(event.transaction.hash).toBe(hash);
          expect(event.transaction.status).toBe('pending');
          resolve();
        });

        service.trackTransaction(hash, chainId);
      });
    });

    it('should emit transaction:confirmed event when transaction succeeds', () => {
      return new Promise<void>((resolve) => {
        const hash = '0xconfirmed123';
        const chainId = CHAIN_IDS.BASE_SEPOLIA;

        service.trackTransaction(hash, chainId);

        service.once('transaction:confirmed', (event: TransactionEvent) => {
          expect(event.type).toBe('transaction:confirmed');
          expect(event.transaction.hash).toBe(hash);
          expect(event.transaction.status).toBe('confirmed');
          expect(event.transaction.blockNumber).toBe(12345);
          expect(event.transaction.gasUsed).toBe(21000n);
          resolve();
        });

        const receipt: TransactionReceipt = {
          blockHash: '0xblock',
          blockNumber: 12345n,
          contractAddress: null,
          cumulativeGasUsed: 100000n,
          effectiveGasPrice: 1000000000n,
          from: '0xfrom',
          gasUsed: 21000n,
          logs: [],
          logsBloom: '0x',
          status: 'success',
          to: '0xto',
          transactionHash: hash,
          transactionIndex: 0,
          type: 'eip1559',
          root: undefined,
        };

        service.updateTransactionStatus(hash, receipt);
      });
    });

    it('should emit transaction:failed event when transaction fails', () => {
      return new Promise<void>((resolve) => {
        const hash = '0xfailed123';
        const chainId = CHAIN_IDS.BASE_SEPOLIA;

        service.trackTransaction(hash, chainId);

        service.once('transaction:failed', (event: TransactionEvent) => {
          expect(event.type).toBe('transaction:failed');
          expect(event.transaction.hash).toBe(hash);
          expect(event.transaction.status).toBe('failed');
          resolve();
        });

        const receipt: TransactionReceipt = {
          blockHash: '0xblock',
          blockNumber: 54321n,
          contractAddress: null,
          cumulativeGasUsed: 50000n,
          effectiveGasPrice: 1000000000n,
          from: '0xfrom',
          gasUsed: 50000n,
          logs: [],
          logsBloom: '0x',
          status: 'reverted',
          to: '0xto',
          transactionHash: hash,
          transactionIndex: 0,
          type: 'eip1559',
          root: undefined,
        };

        service.updateTransactionStatus(hash, receipt);
      });
    });

    it('should emit transaction:updated event for all transaction updates', () => {
      const hash = '0xupdated123';
      const chainId = CHAIN_IDS.BASE_SEPOLIA;

      let updateCount = 0;

      service.on('transaction:updated', (event: TransactionEvent) => {
        updateCount++;
        expect(event.transaction.hash).toBe(hash);
      });

      // Track transaction (should emit 2 updates: tracked + pending)
      service.trackTransaction(hash, chainId);
      expect(updateCount).toBe(2);

      // Update status (should emit 1 more update: confirmed)
      const receipt: TransactionReceipt = {
        blockHash: '0xblock',
        blockNumber: 99999n,
        contractAddress: null,
        cumulativeGasUsed: 100000n,
        effectiveGasPrice: 1000000000n,
        from: '0xfrom',
        gasUsed: 21000n,
        logs: [],
        logsBloom: '0x',
        status: 'success',
        to: '0xto',
        transactionHash: hash,
        transactionIndex: 0,
        type: 'eip1559',
        root: undefined,
      };

      service.updateTransactionStatus(hash, receipt);
      expect(updateCount).toBe(3);
    });

    it('should support multiple event listeners', () => {
      return new Promise<void>((resolve) => {
        const hash = '0xmulti123';
        const chainId = CHAIN_IDS.BASE_SEPOLIA;

        let listener1Called = false;
        let listener2Called = false;

        service.once('transaction:tracked', () => {
          listener1Called = true;
          checkBothCalled();
        });

        service.once('transaction:tracked', () => {
          listener2Called = true;
          checkBothCalled();
        });

        function checkBothCalled() {
          if (listener1Called && listener2Called) {
            resolve();
          }
        }

        service.trackTransaction(hash, chainId);
      });
    });
  });
});