# Transaction Monitoring Documentation

## Overview

Dan's List implements comprehensive transaction monitoring using Blockscout SDK and a custom event-driven architecture. This system provides real-time transaction tracking, status updates, and integration with the frontend UI.

## Architecture

### Components

1. **BlockscoutMonitoringService** - Core service for tracking transactions
2. **TransactionProvider** - React Context provider for real-time updates
3. **TransactionHistory** - UI component for displaying transaction history
4. **Event Emitters** - Pub/sub pattern for transaction updates

### Data Flow

```
Transaction Creation
      ↓
BlockscoutMonitoringService
      ↓
Event Emission (transaction:tracked, transaction:pending)
      ↓
TransactionProvider (listens to events)
      ↓
React Components (useTransactionContext)
      ↓
UI Updates
```

## BlockscoutMonitoringService

### Features

- Track pending transactions
- Monitor transaction confirmations
- Maintain transaction history (max 100 items)
- Event emission for real-time updates
- Support for multiple blockchain networks

### Supported Networks

| Network | Chain ID | Identifier |
|---------|----------|------------|
| Ethereum Mainnet | 1 | `ETHEREUM_MAINNET` |
| Arbitrum One | 42161 | `ARBITRUM_ONE` |
| Arbitrum Sepolia | 421614 | `ARBITRUM_SEPOLIA` |
| Polygon | 137 | `POLYGON` |
| Base | 8453 | `BASE` |
| Base Sepolia | 84532 | `BASE_SEPOLIA` |
| Optimism | 10 | `OPTIMISM` |
| Hardhat | 31337 | `HARDHAT` |

### Usage

#### Basic Transaction Tracking

```typescript
import { getMonitoringService, CHAIN_IDS } from '@/lib/monitoring/blockscout.service';

const monitoringService = getMonitoringService();

// Track a new transaction
monitoringService.trackTransaction(
  '0x123abc...',
  CHAIN_IDS.BASE_SEPOLIA
);

// Update transaction status (when receipt received)
monitoringService.updateTransactionStatus(txHash, receipt);

// Get pending transactions
const pending = monitoringService.getPendingTransactions();

// Get transaction history
const history = monitoringService.getTransactionHistory();

// Get specific transaction
const tx = monitoringService.getTransaction('0x123abc...');

// Clear all data
monitoringService.clear();
```

### Event System

The service extends EventEmitter and emits the following events:

#### Event Types

| Event Type | Description | When Emitted |
|------------|-------------|--------------|
| `transaction:tracked` | New transaction added | When `trackTransaction()` is called |
| `transaction:pending` | Transaction is pending | When `trackTransaction()` is called |
| `transaction:confirmed` | Transaction confirmed | When receipt shows success |
| `transaction:failed` | Transaction failed | When receipt shows failure |
| `transaction:updated` | Any transaction update | On all events above |

#### Event Payload

```typescript
interface TransactionEvent {
  type: TransactionEventType;
  transaction: TransactionStatus;
  timestamp: number;
}

interface TransactionStatus {
  hash: string;
  chainId: ChainId;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: bigint;
  timestamp?: number;
}
```

#### Subscribing to Events

```typescript
import { getMonitoringService } from '@/lib/monitoring/blockscout.service';

const service = getMonitoringService();

// Listen to all updates
service.on('transaction:updated', (event) => {
  console.log('Transaction updated:', event.transaction.hash);
  console.log('Status:', event.transaction.status);
});

// Listen to specific events
service.on('transaction:confirmed', (event) => {
  console.log('Transaction confirmed!', event.transaction.hash);
});

service.on('transaction:failed', (event) => {
  console.error('Transaction failed:', event.transaction.hash);
});

// One-time listener
service.once('transaction:tracked', (event) => {
  console.log('First transaction tracked');
});
```

## TransactionProvider

React Context provider that integrates with BlockscoutMonitoringService to provide real-time transaction data to components.

### Features

- Automatic event subscription
- Real-time state updates
- Optional auto-refresh
- Centralized transaction management
- React hooks integration

### Setup

Wrap your application or relevant components with the provider:

```typescript
import { TransactionProvider } from '@/lib/monitoring/TransactionProvider';

function App() {
  return (
    <TransactionProvider autoRefresh={true} refreshInterval={5000}>
      <YourComponents />
    </TransactionProvider>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Child components |
| `autoRefresh` | `boolean` | `false` | Enable automatic polling |
| `refreshInterval` | `number` | `5000` | Polling interval in ms |

### Using the Context

```typescript
import { useTransactionContext } from '@/lib/monitoring/TransactionProvider';

function MyComponent() {
  const {
    pendingTransactions,
    transactionHistory,
    trackTransaction,
    refreshTransactions,
    clearTransactions,
    getTransaction,
    isLoading,
    lastUpdate,
  } = useTransactionContext();

  // Track a transaction
  const handleTrack = () => {
    trackTransaction('0x123...', CHAIN_IDS.BASE_SEPOLIA);
  };

  // Display transactions
  return (
    <div>
      <h2>Pending: {pendingTransactions.length}</h2>
      <h2>History: {transactionHistory.length}</h2>
      {lastUpdate && <p>Last updated: {lastUpdate.toLocaleString()}</p>}

      <button onClick={refreshTransactions}>Refresh</button>
      <button onClick={clearTransactions}>Clear All</button>
    </div>
  );
}
```

## TransactionHistory Component

UI component for displaying transaction history with real-time updates.

### Features

- Paginated transaction list
- Status filtering
- Summary statistics
- Block explorer links
- Cross-chain transaction indicators
- Optional real-time updates via context
- Responsive design

### Basic Usage

```typescript
import { TransactionHistory } from '@/app/components/TransactionHistory';

function MyPage() {
  return (
    <TransactionHistory
      agentAddress="0x123..."
      limit={20}
    />
  );
}
```

### With Real-Time Updates

```typescript
import { TransactionProvider } from '@/lib/monitoring/TransactionProvider';
import { TransactionHistory } from '@/app/components/TransactionHistory';

function MyPage() {
  return (
    <TransactionProvider autoRefresh={true}>
      <TransactionHistory
        agentAddress="0x123..."
        limit={20}
        useContext={true}  // Enable real-time updates
      />
    </TransactionProvider>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `agentAddress` | `string` | required | Wallet address to monitor |
| `limit` | `number` | `20` | Transactions per page |
| `autoRefresh` | `boolean` | `false` | Enable polling (standalone mode) |
| `refreshInterval` | `number` | `10000` | Polling interval in ms |
| `useContext` | `boolean` | `false` | Enable real-time updates via provider |

## Integration Patterns

### Pattern 1: Standalone Component (Polling)

For simple use cases without context provider:

```typescript
<TransactionHistory
  agentAddress="0x123..."
  autoRefresh={true}
  refreshInterval={10000}
/>
```

### Pattern 2: Context-Driven (Real-Time Events)

For complex applications with multiple components:

```typescript
// App wrapper
<TransactionProvider autoRefresh={false}>
  <Dashboard />
</TransactionProvider>

// Dashboard component
function Dashboard() {
  const { trackTransaction } = useTransactionContext();

  const handlePurchase = async () => {
    const tx = await contract.purchase();
    trackTransaction(tx.hash, CHAIN_IDS.BASE_SEPOLIA);
  };

  return (
    <>
      <PurchaseButton onClick={handlePurchase} />
      <TransactionHistory
        agentAddress="0x123..."
        useContext={true}  // Will receive real-time updates
      />
    </>
  );
}
```

### Pattern 3: Hybrid Approach

Combine polling with event-driven updates:

```typescript
<TransactionProvider autoRefresh={true} refreshInterval={30000}>
  <TransactionHistory
    agentAddress="0x123..."
    useContext={true}
  />
</TransactionProvider>
```

This provides:
- Real-time updates via events (instant)
- Periodic polling as backup (every 30s)

## Best Practices

### 1. Event Cleanup

Always clean up event listeners to prevent memory leaks:

```typescript
useEffect(() => {
  const service = getMonitoringService();

  const handleUpdate = (event) => {
    // Handle update
  };

  service.on('transaction:updated', handleUpdate);

  return () => {
    service.off('transaction:updated', handleUpdate);
  };
}, []);
```

### 2. Error Handling

Always handle errors when tracking transactions:

```typescript
try {
  monitoringService.trackTransaction(hash, chainId);
} catch (error) {
  console.error('Failed to track transaction:', error);
  // Show error to user
}
```

### 3. Performance Optimization

- Use `autoRefresh` sparingly to reduce API calls
- Set appropriate `refreshInterval` (5-10 seconds minimum)
- Clear transaction history when no longer needed
- Limit history size (default: 100 transactions)

### 4. Testing

Mock the monitoring service in tests:

```typescript
import { vi } from 'vitest';

vi.mock('@/lib/monitoring/blockscout.service', () => ({
  getMonitoringService: vi.fn(() => ({
    trackTransaction: vi.fn(),
    getPendingTransactions: vi.fn(() => []),
    getTransactionHistory: vi.fn(() => []),
    on: vi.fn(),
    off: vi.fn(),
  })),
  CHAIN_IDS: {
    BASE_SEPOLIA: '84532',
  },
}));
```

## Examples

### Example 1: Track Purchase Transaction

```typescript
import { getMonitoringService, CHAIN_IDS } from '@/lib/monitoring/blockscout.service';

async function handlePurchase() {
  const service = getMonitoringService();

  // Listen for confirmation
  service.once('transaction:confirmed', (event) => {
    toast.success(`Purchase confirmed! Block ${event.transaction.blockNumber}`);
  });

  service.once('transaction:failed', (event) => {
    toast.error('Purchase failed!');
  });

  // Execute purchase
  const tx = await contract.purchase(listingId, { value: price });

  // Track transaction
  service.trackTransaction(tx.hash, CHAIN_IDS.BASE_SEPOLIA);

  return tx.hash;
}
```

### Example 2: Multi-Component Real-Time Updates

```typescript
// App.tsx
function App() {
  return (
    <TransactionProvider autoRefresh={true}>
      <Header />
      <Dashboard />
      <Sidebar />
    </TransactionProvider>
  );
}

// Header.tsx
function Header() {
  const { pendingTransactions } = useTransactionContext();

  return (
    <header>
      <Badge count={pendingTransactions.length}>
        Pending Transactions
      </Badge>
    </header>
  );
}

// Dashboard.tsx
function Dashboard() {
  return (
    <TransactionHistory
      agentAddress="0x123..."
      useContext={true}
    />
  );
}

// Sidebar.tsx
function Sidebar() {
  const { transactionHistory } = useTransactionContext();
  const recentTx = transactionHistory.slice(0, 5);

  return (
    <aside>
      <h3>Recent Transactions</h3>
      {recentTx.map(tx => (
        <TxSummary key={tx.hash} transaction={tx} />
      ))}
    </aside>
  );
}
```

### Example 3: Custom Event Handlers

```typescript
import { getMonitoringService } from '@/lib/monitoring/blockscout.service';

function setupTransactionAnalytics() {
  const service = getMonitoringService();

  service.on('transaction:confirmed', (event) => {
    // Track successful transactions
    analytics.track('transaction_confirmed', {
      hash: event.transaction.hash,
      chainId: event.transaction.chainId,
      gasUsed: event.transaction.gasUsed?.toString(),
    });
  });

  service.on('transaction:failed', (event) => {
    // Track failed transactions
    analytics.track('transaction_failed', {
      hash: event.transaction.hash,
      chainId: event.transaction.chainId,
    });

    // Alert if multiple failures
    const recentFailures = service
      .getTransactionHistory()
      .filter(tx => tx.status === 'failed')
      .length;

    if (recentFailures > 3) {
      alerting.send('Multiple transaction failures detected');
    }
  });
}
```

## Troubleshooting

### Transactions Not Updating

1. Check event listeners are properly set up
2. Verify transaction hash is correct
3. Ensure network/chainId matches
4. Check browser console for errors

### Memory Leaks

1. Remove event listeners in cleanup functions
2. Clear transaction history when component unmounts
3. Limit `autoRefresh` usage

### Performance Issues

1. Reduce `refreshInterval` frequency
2. Limit transaction history size
3. Use pagination in TransactionHistory component
4. Debounce rapid updates

## API Reference

### BlockscoutMonitoringService

- `trackTransaction(hash: string, chainId: ChainId): void`
- `updateTransactionStatus(hash: string, receipt: TransactionReceipt): void`
- `getPendingTransactions(): TransactionStatus[]`
- `getTransactionHistory(): TransactionStatus[]`
- `getTransaction(hash: string): TransactionStatus | undefined`
- `clear(): void`
- `on(event: TransactionEventType, listener: Function): this`
- `once(event: TransactionEventType, listener: Function): this`
- `off(event: TransactionEventType, listener: Function): this`

### TransactionProvider

- `useTransactionContext(): TransactionContextState`

### TransactionContextState

```typescript
interface TransactionContextState {
  pendingTransactions: TransactionStatus[];
  transactionHistory: TransactionStatus[];
  trackTransaction: (hash: string, chainId: ChainId) => void;
  refreshTransactions: () => void;
  clearTransactions: () => void;
  getTransaction: (hash: string) => TransactionStatus | undefined;
  isLoading: boolean;
  lastUpdate: Date | null;
}
```

## Future Enhancements

- WebSocket support for real-time updates
- Transaction grouping by wallet/contract
- Advanced filtering and search
- Export transaction history (CSV, JSON)
- Gas price tracking and analytics
- Multi-chain aggregation
- Transaction replays and simulations

---

For more information, see:
- [Blockscout SDK Documentation](https://docs.blockscout.com/)
- [React Context API](https://react.dev/reference/react/useContext)
- [EventEmitter Documentation](https://nodejs.org/api/events.html)
