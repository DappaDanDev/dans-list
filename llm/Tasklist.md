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

_Goal: light up autonomous wallets and payments so Buyer/Seller agents can settle real trades and our dashboards reflect on-chain activity._

### Task 4.1: Implement Vincent Wallet Service (2 hours)

Create `src/lib/vincent/wallet.service.ts` to manage PKP wallet lifecycle using `@lit-protocol/lit-node-client`.
- [ ] Instantiate a shared `LitNodeClient` and expose `createAgentWallet(agentId: string)` plus `signTypedData(request)` helpers that persist `vincentPkpId` and `policies` on `Agent` (`prisma/schema.prisma:91-122`).
- [ ] Update `scripts/validate-env.mjs` to require `VINCENT_LIT_NETWORK` and warn when unset (`scripts/validate-env.mjs:17-101`).
- [ ] Wire a CLI script `scripts/create-agent-wallet.ts` that provisions wallets for seeded agents.
- [ ] Add Vitest coverage in `src/lib/vincent/__tests__/wallet.service.test.ts` mocking Lit responses and asserting structured logging with `loggers.vincent`.

### Task 4.2: Apply Vincent Policies in Agents & A2A (1.5 hours)

- [ ] Update `src/lib/agents/buyer/agent.ts` so `executePurchase` ensures an active Vincent wallet, records policy hashes on `Message`, and includes signature proofs in A2A payloads.
- [ ] Update `src/lib/agents/seller/agent.ts` to store per-listing policy metadata and expose `setPolicyThresholds` that syncs to Vincent before publishing listings.
- [ ] Extend `src/lib/agents/a2a/server.ts` to validate wallet proofs before invoking handlers, returning `ErrorCodes.UNAUTHORIZED` when verification fails.
- [ ] Add scenario tests in `src/lib/agents/buyer/__tests__/agent.test.ts` and `src/lib/agents/seller/__tests__/agent.test.ts` covering policy enforcement and failure paths.

### Task 4.3: Integrate Avail Nexus Payment Service (2 hours)

- [ ] Create `src/lib/payments/nexus.service.ts` that wraps the official Nexus SDK, exposing `findRoute` and `executeRoute` with structured logging and retry logic.
- [ ] Extend `scripts/validate-env.mjs` to validate `NEXUS_NETWORK` and any required API tokens.
- [ ] Modify `BuyerAgent.executePurchase` to call Nexus for route discovery, persist `nexusRouteId`/`nexusSteps` on `Transaction` (`prisma/schema.prisma:124-159`), and update status once the webhook callback lands.
- [ ] Add `src/app/api/nexus/webhook/route.ts` to verify Nexus callbacks and mark transactions `CONFIRMED`/`FAILED`.
- [ ] Write tests in `src/lib/payments/__tests__/nexus.service.test.ts` and extend buyer agent tests for happy-path purchases.

### Task 4.4: Deploy Contracts with Hardhat Ignition (1.5 hours)

- [ ] Add `ignition/modules/VerifiableMarketplace.ts` targeting Base Sepolia (chain 84532) with configurable PYUSD address per PRD §3.5.
- [ ] Implement `scripts/deploy-marketplace.ts` that runs Ignition, captures deployed addresses, and pipes them into `scripts/sync-envio-config.ts`.
- [ ] Document deployment steps in `README.md` and update `.env.example` with `MARKETPLACE_ADDRESS` placeholders (`.env.example:47-63`).
- [ ] Add a smoke test `test/VerifiableMarketplace.deploy.ts` asserting owner fee configuration and pause controls post-deploy.

### Task 4.5: Build Transaction History View (1 hour)

- [ ] Create `src/app/components/TransactionHistory.tsx` rendering paginated history using `useBlockscout` (`src/lib/monitoring/useBlockscout.ts:9-69`).
- [ ] Add `src/app/api/transactions/route.ts` to proxy Blockscout SDK with cache headers.
- [ ] Write UI tests in `src/app/components/__tests__/TransactionHistory.test.tsx`, including jest-axe accessibility assertions and filter behaviour.

### Task 4.6: Finalize Blockscout Monitoring Integration (1 hour)

- [ ] Expose transaction context so `TransactionHistory` and notification toasts share state (`src/lib/monitoring/blockscout.service.ts:95-200`).
- [ ] Extend `src/lib/monitoring/__tests__/blockscout.service.test.ts` to cover Nexus webhook updates and history pagination.
- [ ] Capture integration notes and screenshots in `docs/monitoring.md` once UI is complete.

## Phase 5: Integration and Testing (Day 4 - 8 hours)

_Goal: deliver a shippable marketplace experience with real data, resilient error handling, and comprehensive test coverage._

### Task 5.0: Marketplace Shell & Navigation (1 hour)

- [ ] Replace the component showcase in `src/app/page.tsx` with a full marketplace layout (hero, CTA, live metrics, featured listings).
- [ ] Add navigation in `src/app/layout.tsx` linking Upload Listing, Agent Insights, Market Activity, and Transaction History.
- [ ] Ensure global styles in `src/app/globals.css` support dark/light themes per PRD visuals.

### Task 5.1: End-to-End Purchase Flow Validation (2 hours)

- [ ] Automate the full flow in `tests/e2e/purchase-flow.spec.ts`: image upload → `src/lib/ai/imageAnalysis.ts` → seller listing → buyer semantic search (`src/app/api/a2a/route.ts`) → Nexus payment execution → HyperSync dashboard refresh.
- [ ] Seed deterministic listings using Prisma (`prisma/seed.ts`) so tests never rely on placeholders.
- [ ] Assert required Pino logs for each step using log spies in Vitest.

### Task 5.2: Complete HyperSync Analytics Integration (1.5 hours)

- [ ] Replace mocks in `src/lib/analytics/hypersync.service.ts:55-240` with real GraphQL queries + streaming subscriptions.
- [ ] Update `scripts/sync-envio-config.ts` to emit entities for `MarketplaceFeeEvent` and `FundsWithdrawnEvent`, then regenerate types.
- [ ] Add tests in `src/lib/analytics/__tests__/hypersync.service.test.ts` mocking HyperSync HTTP + WebSocket responses.
- [ ] Ensure `MarketActivityDashboard` (`src/app/components/MarketActivityDashboard.tsx`) consumes the updated service with fallback polling.

### Task 5.3: Real-time Activity Feed Component (1 hour)

- [ ] Implement `src/app/components/ActivityFeed.tsx` subscribed to `streamMarketEvents` to render live event tiles.
- [ ] Write tests in `src/app/components/__tests__/ActivityFeed.test.tsx` covering loading/empty/high-volume states with jest-axe.
- [ ] Add Storybook stories (if enabled) or MDX docs for design review.

### Task 5.4: Global Error Handling & Resilience (1 hour)

- [ ] Add `src/app/error.tsx` and `src/app/components/ErrorToast.tsx` for user-friendly error surfacing.
- [ ] Normalise API error payloads across `src/app/api/**/route.ts` to `{ error: { code, message, traceId } }` and cover with integration tests.
- [ ] Implement retry helpers (exponential backoff + circuit breaker counters) for Nexus/HyperSync calls with structured logging.

### Task 5.5: Performance & UX Optimisation (1 hour)

- [ ] Analyse bundle size (`next build --analyze`), trim unused exports, and document results in `docs/perf-report.md`.
- [ ] Memoise expensive selectors and add Suspense boundaries for analytics components.
- [ ] Set cache headers for analytics endpoints (`/api/agents/[id]`, `/api/transactions`) and verify via integration tests.

### Task 5.6: Test Suite & QA Sign-off (1.5 hours)

- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test --coverage`, `pnpm test:e2e`, and publish coverage summary.
- [ ] Add CI workflow (GitHub Actions) covering Node 18/20 with Postgres service and Hardhat jobs.
- [ ] Execute manual QA checklist (wallet creation, cross-chain payment, dashboard updates) and log results in `QA_CHECKLIST.md`.
- [ ] Draft release notes summarising Phase 4 & 5 deliverables.

## Testing Checklist

### Contract & Wallet Testing

- [ ] Hardhat unit tests for VerifiableMarketplace fee + withdrawal flows.
- [ ] Ignition deployment smoke test (`test/VerifiableMarketplace.deploy.ts`).
- [ ] Vincent wallet service Vitest suite.

### Integration & UI Tests

- [ ] API route integration tests (A2A, agents, transactions, Nexus webhook).
- [ ] HyperSync analytics unit + integration tests.
- [ ] UI accessibility tests for Agent Dashboard, Market Activity Dashboard, Transaction History, Activity Feed.

### End-to-End Tests

- [ ] Playwright/Vitest E2E covering image upload → purchase → analytics refresh.
- [ ] Nexus webhook simulation ensuring transaction status updates and dashboard refresh.

### Recommended Commands

```bash
# Quality gates
pnpm lint
pnpm typecheck
pnpm test --coverage
pnpm test:e2e

# Contracts & deployment
npx hardhat test
npx hardhat ignition deploy ./ignition/modules/VerifiableMarketplace.ts --network baseSepolia

# Sync Envio after deployment
pnpm tsx scripts/sync-envio-config.ts
```
