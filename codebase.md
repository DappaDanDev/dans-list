# Codebase Overview

This document captures the core files that drive Dan's List. For chaque file we list where it lives, what it does, and which product feature(s) it powers so a new contributor can orient themselves quickly.

---

## Frontend Shell & Pages (Next.js App Router)

- `src/app/layout.tsx` – Root layout that wires global fonts, the Blockscout notification provider, top navigation, and footer around every page (affects all UI).
- `src/app/page.tsx` – Marketplace landing page assembling the hero, live metrics, and featured listings sections.
- `src/app/error.tsx` – Global error boundary for the App Router, renders a user-friendly fallback when server components throw.
- `src/app/globals.css` – Tailwind/global CSS tokens shared across components.
- `src/app/listings/page.tsx` – Browse page with search, category filters, pagination, and calls to `/api/listings`; surfaces the marketplace catalogue.
- `src/app/listings/[id]/page.tsx` – Listing detail page (fetches a single listing, shows agent purchase panel and related metadata).

## Core UI Components (src/app/components)

- `Navigation.tsx` – Sticky top nav with brand links, agent dashboard shortcut, and responsive mobile menu.
- `Footer.tsx` – Footer with quick links, contact, and social proof; closes every page.
- `Hero.tsx` – Landing hero banner with CTA buttons (“Browse Listings”, “Create Listing”).
- `LiveMetrics.tsx` – Polls `/api/metrics/summary` for live marketplace stats (total listings, 24h volume, active agents) and renders metric cards.
- `FeaturedListings.tsx` – Fetches top listings to highlight on the homepage, including responsive card grid.
- `MarketActivityDashboard.tsx` – Client component that combines GraphQL data + streaming analytics to visualise market metrics, top agents, and recent activity widgets.
- `ActivityFeed.tsx` – Subscribes to `MarketAnalyticsService.streamMarketEvents` to show live blockchain events with icons, timestamps, and auto-scroll behaviour.
- `AgentDashboard.tsx` – Fetches `/api/agents/[id]` to display agent stats (volume, success rate, latest listings/transactions) with optional auto-refresh.
- `TransactionHistory.tsx` – Calls `/api/agents/[address]/transactions`, offers filters, pagination, explorer links, and optional live updates via the monitoring context.
- `VincentConnect.tsx` – End-to-end Vincent JWT auth flow: handles redirect, local JWT storage, backend verification, and exposes callbacks to parents.
- `AgentPurchasePanel.tsx` – Glue component that combines Vincent auth + `/api/agents/purchase` endpoint to let an agent swap PyUSD, run Nexus transfer, and show receipts.
- `ImageUpload.tsx` – File uploader with drag/drop support, previews, and validation for image analysis.
- `Button.tsx`, `Input.tsx`, `LoadingSpinner.tsx` – Shared design system primitives used across the app.
- `ErrorBoundary.tsx` – Client-side error boundary wrapper to catch render-time issues inside specific component trees.
- `ActivityFeed.tsx`, `LiveMetrics.tsx`, `MarketActivityDashboard.tsx`, `AgentDashboard.tsx`, `TransactionHistory.tsx` – together power the “real-time analytics” feature set.

## Providers & Hooks

- `src/app/providers/BlockscoutProvider.tsx` – Wraps the root layout with Blockscout’s `NotificationProvider` so toast notifications work anywhere.
- `src/lib/monitoring/TransactionProvider.tsx` – React context that exposes pending/history transactions, listens to `BlockscoutMonitoringService`, and triggers UI updates.
- `src/lib/monitoring/useBlockscout.ts` – Hook that exposes helpers (`showTransactionHistory`, `getTransactionHistory`) for components to tap into Blockscout monitoring.

## API Routes (src/app/api)

- `analyze/route.ts` – POST endpoint that runs GPT‑4o vision (`analyzeProductImage`) to turn product photos into structured listing data.
- `metrics/summary/route.ts` – GET endpoint aggregating Prisma metrics for the LiveMetrics dashboard.
- `listings/route.ts` & `listings/[id]/route.ts` – CRUD read endpoints for listings catalogue and listing detail (filters, pagination, SEO-friendly dynamic routes).
- `agents/[id]/route.ts` – Returns agent profile, listings, and transactions to drive the AgentDashboard.
- `agents/[id]/transactions/route.ts` – Paginated history API with summary stats for TransactionHistory.
- `agents/purchase/route.ts` – Orchestrates the full agent purchase workflow by delegating to `AgentService.executePurchase`.
- `a2a/route.ts` – JSON-RPC A2A router exposing marketplace search and offer handlers (agent-to-agent communications).
- `vincent/auth/verify/route.ts` – Validates Vincent JWTs server-side and persists `VincentAuth` records for delegatee execution.
- `metrics/summary/route.ts`, `webhooks/nexus/route.ts` (current implementation) – Hooks for metrics and Nexus status callbacks (webhook slated for replacement by SDK events).

## Domain Services & Libraries (src/lib)

- `utils/logger.ts` – Pino wrapper configuring child loggers per subsystem (`api`, `vincent`, `nexus`, etc.).
- `database/prisma.service.ts` – Singleton Prisma client factory plus health checks, connect/disconnect helpers, and type exports.
- `ai/imageAnalysis.ts` – GPT‑4o powered listing extractor with validation, retry, and batch analysis helpers.
- `graphql/queries.ts` – Centralised GraphQL documents + TypeScript types for Envio HyperSync queries.
- `analytics/hypersync.service.ts` – Fetches agent performance via GraphQL and provides a polling-based event stream for ActivityFeed/MarketActivityDashboard.
- `monitoring/blockscout.service.ts` – Wraps Blockscout SDK, tracks pending transactions, emits events, and exposes toast helpers.
- `agents/agent.service.ts` – High-level orchestrator handling PyUSD→USDC swap, cross-chain transfer via Nexus, and Prisma persistence.
- `agents/a2a/server.ts` & `types.ts` – JSON-RPC server for agent communication (method registration, validation, error handling).
- `agents/buyer/*` & `agents/seller/*` – Buyer/seller agent classes that use the Vincent/Nexus services to submit offers and respond to negotiations.
- `vincent/config.ts` – Central Vincent configuration (app ID, ability IDs, chain RPCs).
- `vincent/abilityClient.ts` – Factory helpers to instantiate Vincent ability clients (ERC‑20 approval, transfer, Uniswap swap, EVM transaction signer).
- `vincent/wallet-ability.service.ts` – Business logic around abilities: resolves `VincentAuth`, runs precheck/execute flows for swaps, approvals, transfers, and stores proofs.
- `vincent/provider-ability.ts` – EIP‑1193 provider that signs transactions via Vincent’s EVM signer ability (used to initialise the Nexus SDK).
- `vincent/signer.ts`, `vincent/wallet.service.ts`, `vincent/jwt.service.ts`, `vincent/types.ts` – Supporting utilities for PKP wallet lookup, JWT parsing, and ability payload typing.
- `nexus/service.ts` – Wrapper around `@avail-project/nexus-core`: initialises the SDK with the Vincent provider, auto-approves intents/allowances, triggers transfers, and updates Prisma when events fire.

## Blockchain & Contract Tooling

- `contracts/VerifiableMarketplace.sol` – Marketplace smart contract (listing creation, purchases, fee management, pause controls).
- `hardhat.config.ts` – Hardhat configuration for local/testnet deployments (Base Sepolia RPC, plugins).
- `ignition/modules/VerifiableMarketplace.ts` – Ignition module to deploy `VerifiableMarketplace` with consistent parameters.
- `scripts/deploy-marketplace.ts` – End-to-end deployment script: runs Ignition, verifies on Basescan, updates Envio config, writes deployment artifacts.
- `scripts/sync-envio-config.ts` – Generates `envio/config.yaml` and schema from deployed contract information.
- `docs/monitoring.md` – Developer handbook for the monitoring stack, event flows, and troubleshooting (useful reference when touching analytics features).

## Database Schema

- `prisma/schema.prisma` – Source of truth for Listings, Agents, Transactions, Proofs, VincentAuth, etc. (run `prisma migrate` after changes).

## Feature Mapping (Quick Reference)

- **Listing creation & enrichment** – `src/app/api/analyze/route.ts`, `src/lib/ai/imageAnalysis.ts`, `ImageUpload.tsx`.
- **Marketplace discovery** – `src/app/listings/page.tsx`, `FeaturedListings.tsx`, `Hero.tsx`, `LiveMetrics.tsx`.
- **Agent insights** – `AgentDashboard.tsx`, `/api/agents/[id]`, `MarketActivityDashboard.tsx`, `ActivityFeed.tsx`, `analytics/hypersync.service.ts`.
- **Autonomous purchasing** – `AgentPurchasePanel.tsx`, `/api/agents/purchase`, `agents/agent.service.ts`, `vincent/*`, `nexus/service.ts`.
- **Transaction monitoring** – `TransactionHistory.tsx`, `/api/agents/[address]/transactions`, `monitoring/blockscout.service.ts`, `TransactionProvider.tsx`.
- **Vincent authentication** – `VincentConnect.tsx`, `/api/vincent/auth/verify`, `vincent/jwt.service.ts`, `VincentAuth` model.
- **Blockchain deployment/indexing** – `contracts/VerifiableMarketplace.sol`, `hardhat.config.ts`, `ignition/modules/VerifiableMarketplace.ts`, `scripts/deploy-marketplace.ts`, `scripts/sync-envio-config.ts`.

---

Use this map when adding features or triaging bugs—locate the relevant page/component, follow the linked service or API route, and you’ll land on the code that drives each part of Dan’s List.
