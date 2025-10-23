+# Codebase Overview
     2 +
     3 +This document captures the core files that drive Dan's List. For chaque file we list where it lives, what it does, and which product feature(s) it powers so
         a new contributor can orient themselves quickly.
     4 +
     5 +---
     6 +
     7 +## Frontend Shell & Pages (Next.js App Router)
     8 +
     9 +- `src/app/layout.tsx` – Root layout that wires global fonts, the Blockscout notification provider, top navigation, and footer around every page (affects al
        l UI).
    10 +- `src/app/page.tsx` – Marketplace landing page assembling the hero, live metrics, and featured listings sections.
    11 +- `src/app/error.tsx` – Global error boundary for the App Router, renders a user-friendly fallback when server components throw.
    12 +- `src/app/globals.css` – Tailwind/global CSS tokens shared across components.
    13 +- `src/app/listings/page.tsx` – Browse page with search, category filters, pagination, and calls to `/api/listings`; surfaces the marketplace catalogue.
    14 +- `src/app/listings/[id]/page.tsx` – Listing detail page (fetches a single listing, shows agent purchase panel and related metadata).
    15 +
    16 +## Core UI Components (src/app/components)
    17 +
    18 +- `Navigation.tsx` – Sticky top nav with brand links, agent dashboard shortcut, and responsive mobile menu.
    19 +- `Footer.tsx` – Footer with quick links, contact, and social proof; closes every page.
    20 +- `Hero.tsx` – Landing hero banner with CTA buttons (“Browse Listings”, “Create Listing”).
    21 +- `LiveMetrics.tsx` – Polls `/api/metrics/summary` for live marketplace stats (total listings, 24h volume, active agents) and renders metric cards.
    22 +- `FeaturedListings.tsx` – Fetches top listings to highlight on the homepage, including responsive card grid.
    23 +- `MarketActivityDashboard.tsx` – Client component that combines GraphQL data + streaming analytics to visualise market metrics, top agents, and recent acti
        vity widgets.
    24 +- `ActivityFeed.tsx` – Subscribes to `MarketAnalyticsService.streamMarketEvents` to show live blockchain events with icons, timestamps, and auto-scroll beha
        viour.
    25 +- `AgentDashboard.tsx` – Fetches `/api/agents/[id]` to display agent stats (volume, success rate, latest listings/transactions) with optional auto-refresh.
    26 +- `TransactionHistory.tsx` – Calls `/api/agents/[address]/transactions`, offers filters, pagination, explorer links, and optional live updates via the monit
        oring context.
    27 +- `VincentConnect.tsx` – End-to-end Vincent JWT auth flow: handles redirect, local JWT storage, backend verification, and exposes callbacks to parents.
    28 +- `AgentPurchasePanel.tsx` – Glue component that combines Vincent auth + `/api/agents/purchase` endpoint to let an agent swap PyUSD, run Nexus transfer, and
         show receipts.
    29 +- `ImageUpload.tsx` – File uploader with drag/drop support, previews, and validation for image analysis.
    30 +- `Button.tsx`, `Input.tsx`, `LoadingSpinner.tsx` – Shared design system primitives used across the app.
    31 +- `ErrorBoundary.tsx` – Client-side error boundary wrapper to catch render-time issues inside specific component trees.
    32 +- `ActivityFeed.tsx`, `LiveMetrics.tsx`, `MarketActivityDashboard.tsx`, `AgentDashboard.tsx`, `TransactionHistory.tsx` – together power the “real-time analy
        tics” feature set.
    33 +
    34 +## Providers & Hooks
    35 +
    36 +- `src/app/providers/BlockscoutProvider.tsx` – Wraps the root layout with Blockscout’s `NotificationProvider` so toast notifications work anywhere.
    37 +- `src/lib/monitoring/TransactionProvider.tsx` – React context that exposes pending/history transactions, listens to `BlockscoutMonitoringService`, and trig
        gers UI updates.
    38 +- `src/lib/monitoring/useBlockscout.ts` – Hook that exposes helpers (`showTransactionHistory`, `getTransactionHistory`) for components to tap into Blockscou
        t monitoring.
    39 +
    40 +## API Routes (src/app/api)
    41 +
    42 +- `analyze/route.ts` – POST endpoint that runs GPT‑4o vision (`analyzeProductImage`) to turn product photos into structured listing data.
    43 +- `metrics/summary/route.ts` – GET endpoint aggregating Prisma metrics for the LiveMetrics dashboard.
    44 +- `listings/route.ts` & `listings/[id]/route.ts` – CRUD read endpoints for listings catalogue and listing detail (filters, pagination, SEO-friendly dynamic
        routes).
    45 +- `agents/[id]/route.ts` – Returns agent profile, listings, and transactions to drive the AgentDashboard.
    46 +- `agents/[id]/transactions/route.ts` – Paginated history API with summary stats for TransactionHistory.
    47 +- `agents/purchase/route.ts` – Orchestrates the full agent purchase workflow by delegating to `AgentService.executePurchase`.
    48 +- `a2a/route.ts` – JSON-RPC A2A router exposing marketplace search and offer handlers (agent-to-agent communications).
    49 +- `vincent/auth/verify/route.ts` – Validates Vincent JWTs server-side and persists `VincentAuth` records for delegatee execution.
    50 +- `metrics/summary/route.ts`, `webhooks/nexus/route.ts` (current implementation) – Hooks for metrics and Nexus status callbacks (webhook slated for replacem
        ent by SDK events).
    51 +
    52 +## Domain Services & Libraries (src/lib)
    53 +
    54 +- `utils/logger.ts` – Pino wrapper configuring child loggers per subsystem (`api`, `vincent`, `nexus`, etc.).
    55 +- `database/prisma.service.ts` – Singleton Prisma client factory plus health checks, connect/disconnect helpers, and type exports.
    56 +- `ai/imageAnalysis.ts` – GPT‑4o powered listing extractor with validation, retry, and batch analysis helpers.
    57 +- `graphql/queries.ts` – Centralised GraphQL documents + TypeScript types for Envio HyperSync queries.
    58 +- `analytics/hypersync.service.ts` – Fetches agent performance via GraphQL and provides a polling-based event stream for ActivityFeed/MarketActivityDashboar
        d.
    59 +- `monitoring/blockscout.service.ts` – Wraps Blockscout SDK, tracks pending transactions, emits events, and exposes toast helpers.
    60 +- `agents/agent.service.ts` – High-level orchestrator handling PyUSD→USDC swap, cross-chain transfer via Nexus, and Prisma persistence.
    61 +- `agents/a2a/server.ts` & `types.ts` – JSON-RPC server for agent communication (method registration, validation, error handling).
    62 +- `agents/buyer/*` & `agents/seller/*` – Buyer/seller agent classes that use the Vincent/Nexus services to submit offers and respond to negotiations.
    63 +- `vincent/config.ts` – Central Vincent configuration (app ID, ability IDs, chain RPCs).
    64 +- `vincent/abilityClient.ts` – Factory helpers to instantiate Vincent ability clients (ERC‑20 approval, transfer, Uniswap swap, EVM transaction signer).
    65 +- `vincent/wallet-ability.service.ts` – Business logic around abilities: resolves `VincentAuth`, runs precheck/execute flows for swaps, approvals, transfers
        , and stores proofs.
    66 +- `vincent/provider-ability.ts` – EIP‑1193 provider that signs transactions via Vincent’s EVM signer ability (used to initialise the Nexus SDK).
    67 +- `vincent/signer.ts`, `vincent/wallet.service.ts`, `vincent/jwt.service.ts`, `vincent/types.ts` – Supporting utilities for PKP wallet lookup, JWT parsing,
        and ability payload typing.
    68 +- `nexus/service.ts` – Wrapper around `@avail-project/nexus-core`: initialises the SDK with the Vincent provider, auto-approves intents/allowances, triggers
         transfers, and updates Prisma when events fire.
    69 +
    70 +## Blockchain & Contract Tooling
    71 +
    72 +- `contracts/VerifiableMarketplace.sol` – Marketplace smart contract (listing creation, purchases, fee management, pause controls).
    73 +- `hardhat.config.ts` – Hardhat configuration for local/testnet deployments (Base Sepolia RPC, plugins).
    74 +- `ignition/modules/VerifiableMarketplace.ts` – Ignition module to deploy `VerifiableMarketplace` with consistent parameters.
    75 +- `scripts/deploy-marketplace.ts` – End-to-end deployment script: runs Ignition, verifies on Basescan, updates Envio config, writes deployment artifacts.
    76 +- `scripts/sync-envio-config.ts` – Generates `envio/config.yaml` and schema from deployed contract information.
    77 +- `docs/monitoring.md` – Developer handbook for the monitoring stack, event flows, and troubleshooting (useful reference when touching analytics features).
    78 +
    79 +## Database Schema
    80 +
    81 +- `prisma/schema.prisma` – Source of truth for Listings, Agents, Transactions, Proofs, VincentAuth, etc. (run `prisma migrate` after changes).
    82 +
    83 +## Feature Mapping (Quick Reference)
    84 +
    85 +- **Listing creation & enrichment** – `src/app/api/analyze/route.ts`, `src/lib/ai/imageAnalysis.ts`, `ImageUpload.tsx`.
    86 +- **Marketplace discovery** – `src/app/listings/page.tsx`, `FeaturedListings.tsx`, `Hero.tsx`, `LiveMetrics.tsx`.
    87 +- **Agent insights** – `AgentDashboard.tsx`, `/api/agents/[id]`, `MarketActivityDashboard.tsx`, `ActivityFeed.tsx`, `analytics/hypersync.service.ts`.
    88 +- **Autonomous purchasing** – `AgentPurchasePanel.tsx`, `/api/agents/purchase`, `agents/agent.service.ts`, `vincent/*`, `nexus/service.ts`.
    89 +- **Transaction monitoring** – `TransactionHistory.tsx`, `/api/agents/[address]/transactions`, `monitoring/blockscout.service.ts`, `TransactionProvider.tsx`
        .
    90 +- **Vincent authentication** – `VincentConnect.tsx`, `/api/vincent/auth/verify`, `vincent/jwt.service.ts`, `VincentAuth` model.
    91 +- **Blockchain deployment/indexing** – `contracts/VerifiableMarketplace.sol`, `hardhat.config.ts`, `ignition/modules/VerifiableMarketplace.ts`, `scripts/dep
        loy-marketplace.ts`, `scripts/sync-envio-config.ts`.
    92 +
    93 +---
    94 +
    95 +Use this map when adding features or triaging bugs—locate the relevant page/component, follow the linked service or API route, and you’ll land on the code t
        hat drives each part of Dan’s List.
