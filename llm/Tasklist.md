# Crypto AI Marketplace - Junior Engineer Implementation Guide

## 🎯 Implementation Status Summary

### ✅ Phase 1 COMPLETED
All foundational tasks have been successfully implemented:
- **Next.js** scaffolded in root directory with TypeScript strict mode
- **Hardhat** environment with VerifiableMarketplace.sol contract
- **Prisma** database schema with comprehensive models
- **Blockscout** monitoring using app-sdk (no API keys needed)
- **Envio HyperSync** configured with dynamic address injection
- **Pino** structured logging across all services
- **Core UI Components** built with TDD and accessibility tests

### 📦 Key Changes from Original Plan
- **Package Corrections**: Using `ai` + `@ai-sdk/openai` instead of `@vercel/ai`
- **Blockscout**: Using `@blockscout/app-sdk` instead of API (no keys needed)
- **Directory**: Scaffolding directly in repo root, not subdirectory
- **Chain**: Using Base Sepolia instead of Arbitrum Sepolia

### ⏳ Deferred to Phase 3
- **Vincent SDK** (Lit Protocol PKP wallets) - Agent wallet creation and policies
- **Avail Nexus** - Universal payment service with multi-token support

### 🔑 Pending Credentials
- [ ] OpenAI API key configuration
- [ ] Envio API token setup
- [ ] RPC endpoints for Base Sepolia
- [ ] PostgreSQL database connection

---

## Prerequisites Setup (Complete Before Starting)

### Environment Setup Tasks

### Account Creation Tasks

- [ ] Create OpenAI account and get API key
- [ ] Get Envio API token from https://app.envio.dev
- [ ] Register for Lit Protocol Vincent at https://dashboard.heyvincent.ai/ **(DEFERRED TO PHASE 3)**
- [ ] Create Alchemy or Infura account for RPC endpoints
- [ ] Get test ETH from Arbitrum Sepolia faucet

## Phase 1: Project Foundation (Day 1 Morning - 5 hours) ✅ COMPLETED

### Task 1.1: Initialize Next.js Project (30 min) ✅

```bash
# Commands to run
npx create-next-app@latest dans-list --typescript --tailwind --app
cd dans-list  # Note: Changed from marketplace - we scaffold directly in root
npm install ai @ai-sdk/openai zod  # Note: Corrected package names
npm install @blockscout/app-sdk  # Note: Using app-sdk instead of sdk (no API needed)
npm install @envio-dev/hypersync-client
npm install ethers@6 @wagmi/core viem
```

- [x] Run initialization commands
- [x] Verify project runs with `npm run dev`
- [x] Create `.env.local` file with placeholder keys
- [x] Push initial commit to GitHub

### Task 1.2: Setup Hardhat Environment (45 min) ✅

```bash
# Initialize Hardhat in the project
npm install --save-dev hardhat
npm install --save-dev @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify
npm install --save-dev @nomicfoundation/hardhat-ignition @nomicfoundation/hardhat-viem
npx hardhat init
```

Create `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-ignition";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    "base-sepolia": {  // Note: Using Base Sepolia instead of Arbitrum
      url: process.env.BASE_SEPOLIA_RPC || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};

export default config;
```

- [x] Install Hardhat and plugins
- [x] Create configuration file
- [x] Run `npx hardhat compile` to verify setup
- [x] Create `.env` file for private keys
- [x] Test with `npx hardhat test`
- [x] Created VerifiableMarketplace.sol with comprehensive tests

### Task 1.3: Setup Envio HyperSync (1 hour) ✅

```bash
# Install Envio CLI and dependencies
npm install -g @envio/cli
npm install --save-dev @envio-dev/hypersync-client
npm install @envio/hyperindex-react

# Initialize Envio indexer
npx envio init
```

Create `config.yaml` for Envio (with dynamic address injection):

```yaml
name: CryptoMarketplace
description: AI Agent Marketplace Activity Tracker
networks:
  - id: 84532  # Base Sepolia
    start_block: 0
    contracts:
      - name: Marketplace
        abi_file_path: abis/marketplace.json
        address: ${MARKETPLACE_ADDRESS}  # Injected dynamically via script
        handler: ./src/EventHandlers.ts
        events:
          - event: ListingCreated
          - event: PurchaseInitiated
          - event: AgentRegistered
```

- [x] Install Envio CLI and client
- [ ] Get API token from https://app.envio.dev (pending user configuration)
- [x] Initialize Envio project structure
- [x] Create config.yaml template for multi-chain indexing
- [x] Define GraphQL schema
- [x] Create event handlers directory
- [x] Implemented sync-envio-config.ts script for dynamic address injection

### Task 1.4: Setup Project Structure (30 min) ✅

Create the following folder structure:

```
dans-list/  # Note: Root directory, not marketplace/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/route.ts
│   │   │   ├── agents/route.ts
│   │   │   └── transactions/route.ts
│   │   ├── components/
│   │   │   ├── ImageUpload.tsx ✅
│   │   │   ├── Button.tsx ✅
│   │   │   ├── Input.tsx ✅
│   │   │   ├── LoadingSpinner.tsx ✅
│   │   │   ├── ErrorBoundary.tsx ✅
│   │   │   └── index.ts ✅
│   │   └── providers/
│   │       └── BlockscoutProvider.tsx
│   └── lib/
│       ├── ai/
│       ├── monitoring/
│       │   └── blockscout.service.ts ✅
│       ├── analytics/
│       ├── utils/
│       │   └── logger.ts ✅ (Pino structured logging)
│       └── database/
├── contracts/
│   └── VerifiableMarketplace.sol ✅
├── test/
│   └── VerifiableMarketplace.test.ts ✅
├── prisma/
│   └── schema.prisma ✅
└── scripts/
    └── sync-envio-config.ts ✅
```

- [x] Create all directories
- [x] Add core component files with tests
- [x] Create index.ts files for exports

### Task 1.5: Install and Configure Core SDKs (1 hour) ✅

```bash
# Install remaining dependencies
npm install @openzeppelin/contracts  # ✅ Installed
# npm install @lit-protocol/vincent-sdk  # DEFERRED TO PHASE 3
# npm install @avail-project/nexus @avail-project/nexus-widgets  # DEFERRED TO PHASE 3
npm install @blockscout/app-sdk  # ✅ Installed (no API keys needed)
npm install prisma @prisma/client  # ✅ Installed
npm install pino pino-pretty  # ✅ Installed
```

- [x] Install SDK packages (except Vincent and Avail - deferred)
- [x] Create configuration files
- [x] Add environment variables to `.env.local`
- [x] Setup Prisma with PostgreSQL schema
- [x] Configure Pino structured logging

### Task 1.6: Create Basic UI Components (1.5 hours) ✅

All components created with TDD approach (tests written first):

```typescript
'use client';
// Component examples in src/app/components/
```

- [x] Create ImageUpload component with drag-and-drop
- [x] Create LoadingSpinner component with accessibility
- [x] Create ErrorBoundary component with Pino logging
- [x] Create Button component with variants
- [x] Create Input component with validation
- [x] Test all components with Vitest and jest-axe
- [x] Create component showcase page in app/page.tsx

## Additional Completed Tasks

### Database Setup (Prisma) ✅
Created comprehensive schema in `prisma/schema.prisma`:
- [x] User model with wallet addresses
- [x] Listing model with status tracking
- [x] Agent model with performance metrics
- [x] Transaction model for payments
- [x] Proper indexes and relationships
- [x] Enum types for statuses

### Structured Logging (Pino) ✅
Implemented in `src/lib/utils/logger.ts`:
- [x] Environment-specific configuration
- [x] Custom serializers for blockchain data
- [x] Separate loggers per service
- [x] Integration with ErrorBoundary component

## Phase 2: AI and Analytics Integration (Day 1 Afternoon - 5 hours)

### Task 2.1: Implement AI Image Analysis (1.5 hours)

Create `lib/ai/imageAnalysis.ts`:

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const listingSchema = z.object({
  title: z.string(),
  category: z.string(),
  condition: z.string(),
  price: z.number(),
  description: z.string()
});

export async function analyzeProductImage(imageBase64: string) {
  const { object } = await generateObject({
    model: openai('gpt-4-vision-preview'),
    schema: listingSchema,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Extract marketplace listing details' },
        { type: 'image', image: imageBase64 }
      ]
    }]
  });

  return object;
}
```

- [ ] Implement image analysis function
- [ ] Add Zod schema validation
- [ ] Create error handling
- [ ] Write unit test

### Task 2.2: Create Image Analysis API Route (1 hour)

Create `app/api/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzeProductImage } from '@/lib/ai/imageAnalysis';

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    const result = await analyzeProductImage(image);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
```

- [ ] Create API route
- [ ] Add request validation
- [ ] Implement rate limiting
- [ ] Test with Postman

### Task 2.3: Setup Market Activity Dashboard (2 hours)

Create Envio event handlers `envio/src/EventHandlers.ts`:

```typescript
import { Marketplace } from "../generated";

Marketplace.ListingCreated.handler(async ({ event, context }) => {
  const { listingId, seller, price } = event.params;

  await context.Agent.upsert({
    id: seller,
    totalListings: (agent) => agent.totalListings + 1,
    totalVolume: (agent) => agent.totalVolume + price,
    lastActivity: event.timestamp
  });

  await context.MarketMetrics.upsert({
    id: "global",
    totalListings: (metrics) => metrics.totalListings + 1,
    totalVolume: (metrics) => metrics.totalVolume + price
  });
});
```

- [ ] Create event handlers file
- [ ] Implement ListingCreated handler
- [ ] Implement PurchaseInitiated handler
- [ ] Create AgentRegistered handler
- [ ] Test with local data

### Task 2.4: Build Dashboard Component (1.5 hours)

Create `app/components/MarketActivityDashboard.tsx`:

```typescript
import { useQuery, useSubscription } from '@envio/hyperindex-react';
import { HyperSyncClient } from '@envio-dev/hypersync-client';

export function MarketActivityDashboard() {
  const hyperSync = new HyperSyncClient({
    apiKey: process.env.NEXT_PUBLIC_ENVIO_API_KEY
  });

  const { data } = useQuery({
    query: MARKET_METRICS_QUERY
  });

  return (
    <div className="dashboard">
      {/* Dashboard content */}
    </div>
  );
}
```

- [ ] Build dashboard UI component
- [ ] Setup GraphQL queries
- [ ] Configure real-time subscriptions
- [ ] Add activity visualizations

## Phase 3: Agent Infrastructure (Day 2 - 10 hours)

### Task 3.1: Create Marketplace Search Agent (2 hours)

Create `lib/agents/marketplace/agent.ts`:

```typescript
export class MarketplaceSearchAgent {
  async processQuery(query: string) {
    // Implement semantic search
    // Return results
  }
}
```

- [ ] Implement agent class
- [ ] Add vector search capability
- [ ] Integrate with database
- [ ] Create agent API endpoint

### Task 3.2: Setup A2A Communication Server (1.5 hours)

Create `lib/agents/a2a-server.ts`:

```typescript
import express from 'express';

const app = express();
// Setup A2A protocol endpoints
```

- [ ] Create Express server
- [ ] Implement A2A protocol
- [ ] Add message routing
- [ ] Test with multiple agents

### Task 3.3: Implement Agent-to-Agent Communication (2 hours)

- [ ] Create buyer agent skeleton
- [ ] Create seller agent skeleton
- [ ] Implement message passing
- [ ] Test agent interactions

### Task 3.4: Create Agent Dashboard Component (1.5 hours)

Create `app/components/AgentDashboard.tsx`:

```typescript
export function AgentDashboard({ agentId }: { agentId: string }) {
  // Show agent status
  // Display recent activities
  // Show performance metrics
}
```

- [ ] Create dashboard layout
- [ ] Add status indicators
- [ ] Display transaction count
- [ ] Show success rate

### Task 3.5: Implement HyperSync Analytics Service (1.5 hours)

Create `lib/analytics/HyperSyncAnalytics.ts`:

```typescript
import { HyperSyncClient } from '@envio-dev/hypersync-client';

export class MarketAnalyticsService {
  private client: HyperSyncClient;

  async getAgentPerformance(agentAddress: string) {
    // Implementation
  }

  async streamMarketEvents(callback: (event: any) => void) {
    // Implementation
  }
}
```

- [ ] Create analytics service class
- [ ] Implement agent performance queries
- [ ] Setup real-time event streaming
- [ ] Test with mock data

### Task 3.6: Build Market Visualizations (1.5 hours)

- [ ] Create heatmap component
- [ ] Build transaction flow animation
- [ ] Add chain distribution chart
- [ ] Style with Tailwind CSS

## Phase 4: Wallet and Payment Integration (Day 3 - 10 hours)

### Task 4.1: Setup Vincent SDK (1.5 hours) **DEFERRED TO PHASE 3**

**Note: Vincent (Lit Protocol PKP wallets) has been deferred to Phase 3 per project requirements**

Create `lib/vincent/wallet.ts`:

```typescript
import { VincentSDK } from '@lit-protocol/vincent-sdk';

export async function createAgentWallet(agentId: string) {
  // Create PKP wallet
  // Set policies
  // Return wallet details
}
```

- [ ] Install Vincent SDK - **DEFERRED**
- [ ] Create wallet creation function - **DEFERRED**
- [ ] Implement policy builder - **DEFERRED**
- [ ] Test wallet creation - **DEFERRED**

### Task 4.2: Implement Wallet Policy Engine (1.5 hours) **DEFERRED TO PHASE 3**

Create `lib/vincent/policies.ts`:

```typescript
export function createBuyerPolicy() {
  // Spending limits
  // Approved addresses
}
```

- [ ] Define buyer policies - **DEFERRED**
- [ ] Define seller policies - **DEFERRED**
- [ ] Create policy update function - **DEFERRED**
- [ ] Test policy enforcement - **DEFERRED**

### Task 4.3: Create Smart Contracts with Hardhat (2.5 hours) ✅

Create `contracts/VerifiableMarketplace.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract VerifiableMarketplace is ReentrancyGuard, Pausable, Ownable {
    // Full implementation with listing creation, purchases, fees, etc.
}
```

- [x] Write main contract (VerifiableMarketplace.sol)
- [x] Create comprehensive TypeScript test file
- [x] Run tests: `npx hardhat test`
- [x] Check gas usage and optimize
- [x] Implement security patterns (ReentrancyGuard, Pausable)

### Task 4.4: Deploy Contracts with Hardhat Ignition (1.5 hours)

Create deployment module `ignition/modules/Marketplace.ts`:

```typescript
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MarketplaceModule = buildModule("MarketplaceModule", (m) => {
  const pyusd = m.getParameter("pyusd", "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8");
  const marketplace = m.contract("Marketplace", [pyusd]);
  return { marketplace };
});

export default MarketplaceModule;
```

- [ ] Create Ignition module
- [ ] Write deployment script
- [ ] Deploy to testnet
- [ ] Verify contract
- [ ] Save deployed addresses

### Task 4.5: Setup Avail Nexus Integration (2 hours) **DEFERRED TO PHASE 3**

**Note: Avail Nexus (universal payment service) has been deferred to Phase 3 per project requirements**

Create `lib/payments/nexus.ts`:

```typescript
import { NexusSDK } from '@avail-project/nexus';

export class UniversalPaymentService {
  private nexus: NexusSDK;

  async executePaymentWithAnyToken(
    buyer: string,
    seller: string,
    amount: bigint
  ) {
    // Implementation
  }
}
```

- [ ] Install Nexus SDK - **DEFERRED**
- [ ] Create payment service - **DEFERRED**
- [ ] Implement route finding - **DEFERRED**
- [ ] Test multi-token payments - **DEFERRED**

### Task 4.6: Integrate Blockscout Monitoring (1 hour) ✅

Create `lib/monitoring/blockscout.ts`:

```typescript
// Using @blockscout/app-sdk (no API keys needed)
import { BlockscoutMonitoringService } from './blockscout.service';

export function useTransactionMonitor() {
  // Monitor transactions
  // Show notifications
}
```

- [x] Create monitoring service class
- [x] Setup transaction tracking
- [x] Add WebSocket support for real-time updates
- [x] Test with comprehensive unit tests

### Task 4.7: Build Transaction History View (1 hour)

- [ ] Create history component
- [ ] Integrate Blockscout SDK
- [ ] Format transaction data
- [ ] Add filtering options

## Phase 5: Integration and Testing (Day 4 - 8 hours)

### Task 5.1: Create End-to-End Purchase Flow (2 hours)

Connect all components:

- [ ] User uploads image
- [ ] AI analyzes
- [ ] Listing created
- [ ] Buyer agent searches
- [ ] Purchase executed
- [ ] Payment verified
- [ ] Dashboard updated

### Task 5.2: Implement Real-time Activity Feed (1.5 hours)

Create `app/components/ActivityFeed.tsx`:

```typescript
export function ActivityFeed() {
  // Subscribe to blockchain events
  // Display real-time updates
}
```

- [ ] Create feed component
- [ ] Setup WebSocket connection
- [ ] Subscribe to events
- [ ] Add auto-refresh

### Task 5.3: Add L2 Deployment Support (1.5 hours)

- [ ] Configure Arbitrum RPC
- [ ] Update contract deployment
- [ ] Test on L2 testnet
- [ ] Verify gas costs

### Task 5.4: Implement Error Handling (1 hour)

- [ ] Add try-catch blocks
- [ ] Create error boundaries
- [ ] Add user-friendly messages
- [ ] Implement retry logic

### Task 5.5: Performance Optimization (1 hour)

- [ ] Add response caching
- [ ] Optimize database queries
- [ ] Implement lazy loading
- [ ] Minimize bundle size

### Task 5.6: Testing Suite (1 hour)

- [ ] Write unit tests
- [ ] Create integration tests
- [ ] Test error scenarios
- [ ] Run coverage report


## Testing Checklist

### Unit Tests with Hardhat

- [ ] Smart contract unit tests
- [ ] Test all functions
- [ ] Test access controls
- [ ] Test revert conditions
- [ ] Gas optimization tests

### Integration Tests

- [ ] API endpoints
- [ ] Agent communication
- [ ] Blockchain interactions
- [ ] Notification system
- [ ] End-to-end flows

### Hardhat Testing Commands

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
npx hardhat test --gas-reporter

# Run coverage analysis
npx hardhat coverage

# Run on fork
npx hardhat test --fork https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
```
