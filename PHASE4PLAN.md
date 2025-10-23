# Phase 4: Vincent + Nexus Integration - Technical Specification

**Version:** 2.0 (Revised)
**Date:** 2025-10-23
**Status:** Ready for Implementation
**Target:** Senior Engineer Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Environment Configuration](#3-environment-configuration)
4. [Database Schema](#4-database-schema)
5. [Vincent JWT Authentication](#5-vincent-jwt-authentication)
6. [Vincent Ability Integration](#6-vincent-ability-integration)
7. [Vincent Provider for Nexus](#7-vincent-provider-for-nexus)
8. [Nexus SDK Integration](#8-nexus-sdk-integration)
9. [Purchase Flow Orchestration](#9-purchase-flow-orchestration)
10. [API Routes](#10-api-routes)
11. [Frontend Components](#11-frontend-components)
12. [Testing Strategy](#12-testing-strategy)
13. [Risk Mitigation](#13-risk-mitigation)
14. [References](#14-references)
15. [Implementation Timeline](#15-implementation-timeline)

---

## 1. Executive Summary

### Objective

Integrate Vincent Ability SDK and Nexus Core SDK to enable autonomous agent-driven cross-chain cryptocurrency purchases in Dan's List marketplace.

### Key Requirements

- **Chain Pair:** ETH Sepolia (11155111) ↔ Arbitrum Sepolia (421614)
- **Token Flow:** PyUSD → USDC (Uniswap swap) → Cross-chain transfer
- **Authentication:** JWT-based Vincent authorization (redirect flow)
- **Agent Autonomy:** Auto-approve intents and allowances (no user interaction after JWT)
- **Provider Pattern:** EIP-1193 provider backed by Vincent PKP wallet

### Critical Design Decisions

1. **Vincent EVM Transaction Signer:** Transactions MUST be signed by Vincent's EVM transaction signer ability, NOT directly with app's private key. This ensures transactions broadcast from user's PKP wallet.

2. **Nexus Allowance Hooks:** Token approvals MUST be handled via Nexus SDK's `setOnAllowanceHook`, NOT manual approval calls. Nexus determines correct spender addresses and amounts.

3. **JWT Field Verification:** PKP wallet address extraction requires defensive strategy with fallback fields until actual JWT structure is verified.

### Success Criteria

- ✅ User authorizes app via Vincent JWT (one-time)
- ✅ Agent swaps PyUSD → USDC using Vincent Uniswap ability
- ✅ Agent executes cross-chain USDC transfer via Nexus
- ✅ All transactions sign from user's PKP wallet (not app wallet)
- ✅ All approvals handled automatically via Nexus hooks
- ✅ Transaction history tracked in database
- ✅ Proof of agent actions stored for auditability

---

## 2. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Dan's List Frontend                      │
│  ┌──────────────────────┐        ┌──────────────────────────┐  │
│  │  VincentConnect      │        │  AgentDashboard          │  │
│  │  - JWT Auth Flow     │        │  - Purchase UI           │  │
│  │  - WebAuthClient     │        │  - Transaction History   │  │
│  └──────────┬───────────┘        └───────────┬──────────────┘  │
│             │                                  │                 │
└─────────────┼──────────────────────────────────┼─────────────────┘
              │                                  │
              │ JWT                              │ Purchase Request
              ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                          │
│  ┌──────────────────────┐        ┌──────────────────────────┐  │
│  │  POST /auth/verify   │        │  POST /agents/purchase   │  │
│  │  - Verify JWT        │        │  - Orchestrate flow      │  │
│  │  - Store in DB       │        │  - Return tx hash        │  │
│  └──────────┬───────────┘        └───────────┬──────────────┘  │
│             │                                  │                 │
└─────────────┼──────────────────────────────────┼─────────────────┘
              │                                  │
              ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                          │
│  ┌──────────────────────┐        ┌──────────────────────────┐  │
│  │  VincentWalletService│        │  AgentService            │  │
│  │  - Swap PyUSD→USDC   │        │  - Purchase orchestrator │  │
│  │  - Get wallet address│        │  - Transaction tracking  │  │
│  └──────────┬───────────┘        └───────────┬──────────────┘  │
│             │                                  │                 │
│             ▼                                  ▼                 │
│  ┌──────────────────────┐        ┌──────────────────────────┐  │
│  │  Vincent Ability SDK │        │  Nexus Core SDK          │  │
│  │  - Uniswap swap      │        │  - Cross-chain transfer  │  │
│  │  - EVM tx signer     │        │  - Auto-approve hooks    │  │
│  └──────────┬───────────┘        └───────────┬──────────────┘  │
│             │                                  │                 │
└─────────────┼──────────────────────────────────┼─────────────────┘
              │                                  │
              │ Vincent PKP Signing              │ EIP-1193 Provider
              ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VincentProvider                             │
│  EIP-1193 Provider Implementation                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  eth_sendTransaction:                                       │ │
│  │  1. Serialize unsigned tx                                   │ │
│  │  2. Call Vincent EVM tx signer ability                      │ │
│  │  3. Get signed tx from user's PKP                           │ │
│  │  4. Broadcast signed tx                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│               Blockchain Layer (ETH Sepolia / Arb Sepolia)      │
│  - Uniswap V3 Router (PyUSD → USDC)                             │
│  - USDC Token Contract                                           │
│  - Nexus Router/Bridge (managed by Nexus SDK)                   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Complete Purchase

```
1. User Authorization (One-time)
   Frontend → Vincent WebAuthClient → Redirect to Vincent
   → User approves → Redirect back with JWT
   → POST /auth/verify → Store in DB

2. Agent Purchase Request
   Agent UI → POST /agents/purchase
   → AgentService.executePurchase()

3. Token Swap (PyUSD → USDC)
   AgentService → VincentWalletService.swapPyusdToUsdc()
   → Vincent Uniswap Ability
   → Signs with PKP via EVM tx signer
   → Execute swap on ETH Sepolia
   → Return USDC amount

4. Nexus Initialization
   AgentService → NexusService.initialize()
   → Create VincentProvider (with PKP address)
   → SDK.initialize(provider)
   → Setup hooks (intent + allowance)

5. Cross-Chain Transfer
   AgentService → NexusService.executeTransfer()
   → Nexus calculates route
   → Calls allowance hook (if approval needed)
   → Agent calls allow(['min'])
   → Nexus executes approval via VincentProvider
   → VincentProvider calls EVM tx signer ability
   → Signs approval with PKP
   → Broadcast approval tx
   → Nexus executes transfer via VincentProvider
   → VincentProvider calls EVM tx signer ability
   → Signs transfer with PKP
   → Broadcast transfer tx
   → Return tx hash

6. Transaction Tracking
   AgentService → Save to DB
   → Nexus events update status
   → Frontend polls for updates
```

### Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Vincent SDK** | `@lit-protocol/vincent-app-sdk` | Latest | JWT auth, ability client |
| **Vincent Abilities** | `@lit-protocol/vincent-ability-*` | Latest | Pre-built blockchain operations |
| **Nexus SDK** | `@avail-project/nexus-core` | Latest | Cross-chain transfers |
| **Blockchain Library** | `viem` | ^2.x | Ethereum operations, provider |
| **Database** | Prisma + PostgreSQL | Existing | Auth + transaction storage |
| **Framework** | Next.js 15 App Router | Existing | API routes + frontend |

---

## 3. Environment Configuration

### 3.1. Environment Variables

**File: `.env.example`** (additions)

```bash
# ============================================
# Vincent Configuration
# ============================================

# Vincent App Private Key
# Used ONLY for authenticating with Vincent SDK
# NOT for signing user transactions (PKP does that)
VINCENT_APP_PRIVATE_KEY=41edc11697059bc58ae3a856a47c0ee6167918576a5c82d77d936ef08afc3215

# Vincent App ID
VINCENT_APP_ID=2353371285
NEXT_PUBLIC_VINCENT_APP_ID=2353371285

# Application URL (for JWT audience verification)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# RPC Endpoints
# ============================================

ETHEREUM_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/<your-key>
ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/<your-key>

# ============================================
# Token Contract Addresses
# ============================================

# PyUSD on ETH Sepolia
PYUSD_ETHEREUM_SEPOLIA=0x513421d7fb6A74AE51f3812826Aa2Db99a68F2C9

# PyUSD on Arbitrum Sepolia
PYUSD_ARBITRUM_SEPOLIA=0xc6006A919685EA081697613373C50B6b46cd6F11

# USDC on ETH Sepolia
USDC_ETHEREUM_SEPOLIA=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

# USDC on Arbitrum Sepolia
USDC_ARBITRUM_SEPOLIA=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d

# Uniswap V3 Router on ETH Sepolia
UNISWAP_V3_ROUTER_ETHEREUM_SEPOLIA=0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
```

### 3.2. Configuration Module

**File: `src/lib/vincent/config.ts`** (NEW)

```typescript
/**
 * Vincent + Nexus Configuration
 *
 * Centralized configuration for Vincent Ability SDK and Nexus SDK
 * Type-safe access to environment variables
 */

export const VINCENT_CONFIG = {
  // App credentials
  appPrivateKey: process.env.VINCENT_APP_PRIVATE_KEY!,
  appId: process.env.VINCENT_APP_ID!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,

  // Chain configurations
  chains: {
    ethereumSepolia: {
      chainId: 11155111,
      name: 'Ethereum Sepolia',
      rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC!,
      tokens: {
        pyusd: {
          address: '0x513421d7fb6A74AE51f3812826Aa2Db99a68F2C9',
          decimals: 6,
          symbol: 'PYUSD',
        },
        usdc: {
          address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
          decimals: 6,
          symbol: 'USDC',
        },
      },
      uniswapRouter: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
    },
    arbitrumSepolia: {
      chainId: 421614,
      name: 'Arbitrum Sepolia',
      rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC!,
      tokens: {
        pyusd: {
          address: '0xc6006A919685EA081697613373C50B6b46cd6F11',
          decimals: 6,
          symbol: 'PYUSD',
        },
        usdc: {
          address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
          decimals: 6,
          symbol: 'USDC',
        },
      },
    },
  },
} as const;

/**
 * Validate required environment variables
 * Call this at app startup
 */
export function validateVincentConfig(): void {
  const required = [
    'VINCENT_APP_PRIVATE_KEY',
    'VINCENT_APP_ID',
    'NEXT_PUBLIC_APP_URL',
    'ETHEREUM_SEPOLIA_RPC',
    'ARBITRUM_SEPOLIA_RPC',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check .env.local against .env.example'
    );
  }
}
```

**Why this design:**
- Type-safe access to configuration
- Centralized source of truth
- Easy to test with mock config
- Prevents typos in env var names

---

## 4. Database Schema

### 4.1. Prisma Schema Updates

**File: `prisma/schema.prisma`** (additions)

```prisma
// ============================================
// Vincent Authentication
// ============================================

/// Stores Vincent JWT authorization data
/// One user (PKP wallet) can have one agent
model VincentAuth {
  id            String   @id @default(cuid())

  /// User ID = PKP wallet address (lowercase)
  /// Used as unique identifier for auth records
  userId        String   @unique

  /// PKP wallet address (checksummed)
  /// The user's Vincent-managed wallet
  walletAddress String

  /// Decoded JWT data (JSON blob)
  /// Contains: iss, sub, aud, exp, iat, etc.
  authData      Json

  /// When auth was stored/refreshed
  issuedAt      DateTime @default(now())

  /// JWT expiration time
  /// Extracted from JWT.exp field
  expiresAt     DateTime

  /// Optional link to Agent
  /// One Vincent auth = one agent
  agent         Agent?   @relation(fields: [agentId], references: [id])
  agentId       String?  @unique

  @@index([walletAddress])
  @@index([agentId])
  @@map("vincent_auth")
}

// ============================================
// Agent Updates
// ============================================

model Agent {
  id                String         @id @default(cuid())
  type              AgentType

  /// Wallet address (could be Vincent PKP or regular wallet)
  walletAddress     String         @unique

  /// Vincent PKP authentication (optional)
  /// If present, this agent uses Vincent for transactions
  vincentAuth       VincentAuth?

  /// Vincent-specific fields
  vincentPkpId      String?        // Lit PKP token ID (if applicable)

  /// Existing fields
  eigenAvsId        String?
  policies          Json           @default("{}")
  spendingLimit     Float          @default(1000)
  dailyLimit        Float          @default(100)
  totalTransactions Int            @default(0)
  successRate       Float          @default(100)
  totalVolume       Float          @default(0)
  lastActivity      DateTime?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  // Relations
  fromTransactions  Transaction[]  @relation("FromAgent")
  toTransactions    Transaction[]  @relation("ToAgent")
  listings          Listing[]
  bids              Bid[]
  proofs            Proof[]

  @@index([walletAddress])
  @@index([type])
  @@map("agents")
}

// ============================================
// Transaction Updates
// ============================================

model Transaction {
  id                String            @id @default(cuid())
  hash              String            @unique

  // Agent relationships
  fromAgent         Agent             @relation("FromAgent", fields: [fromAgentId], references: [id])
  fromAgentId       String
  toAgent           Agent             @relation("ToAgent", fields: [toAgentId], references: [id])
  toAgentId         String

  // Listing (optional for non-purchase transfers)
  listing           Listing?          @relation(fields: [listingId], references: [id])
  listingId         String?

  // Transaction details
  amount            BigInt            // In token's smallest unit (wei)
  token             String            // "USDC", "PYUSD", "ETH", etc.
  sourceChain       Int               // Chain ID (11155111, 421614, etc.)
  destinationChain  Int               // Chain ID

  // Nexus route info (for cross-chain txs)
  nexusRouteId      String?           // Nexus route identifier
  nexusSteps        Json?             // Route steps/details
  bridgeFee         Float?            // Bridge fee in token
  swapFee           Float?            // Swap fee in token

  // Status tracking
  status            TransactionStatus
  blockNumber       BigInt?
  gasUsed           BigInt?
  errorMessage      String?

  createdAt         DateTime          @default(now())
  confirmedAt       DateTime?

  @@index([fromAgentId])
  @@index([toAgentId])
  @@index([listingId])
  @@index([status])
  @@index([sourceChain])
  @@index([destinationChain])
  @@map("transactions")
}

enum TransactionStatus {
  PENDING
  CONFIRMED
  FAILED
  REVERTED
}
```

### 4.2. Migration Strategy

```bash
# Generate migration
npx prisma migrate dev --name add_vincent_auth

# Apply migration
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**Why this schema:**
- `VincentAuth` stores JWT separately from Agent (separation of concerns)
- One-to-one relationship (one PKP = one agent)
- `authData` as JSON allows flexibility for JWT structure changes
- Indexes on `walletAddress` for fast lookups
- `Transaction` enhanced with Nexus metadata (route, fees)

---

## 5. Vincent JWT Authentication

### 5.1. JWT Verification Service

**File: `src/lib/vincent/jwt.service.ts`** (NEW)

```typescript
import { verify, type DecodedJWT } from '@lit-protocol/vincent-app-sdk/jwt';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;

/**
 * JWT Verification Service
 *
 * IMPORTANT: JWT field verification needed!
 *
 * According to Vincent docs, JWT contains user's PKP wallet address.
 * The exact field name needs verification:
 * - Standard: decodedJWT.sub (JWT subject claim)
 * - Custom: decodedJWT.pkpEthAddress or decodedJWT.walletAddress
 *
 * Action items:
 * 1. Test actual Vincent authorization flow
 * 2. Inspect JWT structure from real authorization
 * 3. Update extractPkpAddress() with correct field
 *
 * Reference: Vincent SDK JWT docs
 * https://github.com/LIT-Protocol/vincent-app-sdk/tree/main/packages/jwt
 */

/**
 * Extract PKP wallet address from Vincent JWT
 *
 * Uses defensive strategy: tries multiple possible fields
 * until actual JWT structure is verified
 *
 * @param decodedJWT - Decoded JWT from Vincent
 * @returns PKP wallet address (lowercase)
 * @throws Error if address not found in expected fields
 */
export function extractPkpAddress(decodedJWT: DecodedJWT): string {
  // Strategy 1: Check sub field (standard JWT claim)
  if (decodedJWT.sub && decodedJWT.sub.startsWith('0x')) {
    logger.info('Found PKP address in decodedJWT.sub');
    return decodedJWT.sub.toLowerCase();
  }

  // Strategy 2: Check pkpEthAddress field (potential custom claim)
  if ('pkpEthAddress' in decodedJWT) {
    const pkpAddress = (decodedJWT as any).pkpEthAddress;
    if (pkpAddress && typeof pkpAddress === 'string' && pkpAddress.startsWith('0x')) {
      logger.info('Found PKP address in decodedJWT.pkpEthAddress');
      return pkpAddress.toLowerCase();
    }
  }

  // Strategy 3: Check walletAddress field
  if ('walletAddress' in decodedJWT) {
    const walletAddress = (decodedJWT as any).walletAddress;
    if (walletAddress && typeof walletAddress === 'string' && walletAddress.startsWith('0x')) {
      logger.info('Found PKP address in decodedJWT.walletAddress');
      return walletAddress.toLowerCase();
    }
  }

  // Strategy 4: Check address field
  if ('address' in decodedJWT) {
    const address = (decodedJWT as any).address;
    if (address && typeof address === 'string' && address.startsWith('0x')) {
      logger.info('Found PKP address in decodedJWT.address');
      return address.toLowerCase();
    }
  }

  // If none found, log full JWT structure for debugging
  logger.error(
    {
      jwtFields: Object.keys(decodedJWT),
      subValue: decodedJWT.sub,
      subType: typeof decodedJWT.sub,
    },
    'Could not extract PKP address from JWT - unexpected structure'
  );

  throw new Error(
    'PKP wallet address not found in JWT. ' +
      'Checked fields: sub, pkpEthAddress, walletAddress, address. ' +
      'Please verify Vincent JWT structure and update extractPkpAddress()'
  );
}

/**
 * Verify JWT signature and extract PKP address
 *
 * @param jwtString - Raw JWT string from Vincent authorization
 * @param audience - Expected JWT audience (app URL)
 * @returns Decoded JWT and PKP address
 * @throws Error if JWT invalid or PKP address not found
 */
export function verifyVincentJWT(
  jwtString: string,
  audience: string
): {
  decodedJWT: DecodedJWT;
  pkpAddress: string;
} {
  // Verify JWT signature and audience
  // Throws if signature invalid, expired, or audience mismatch
  const decodedJWT = verify(jwtString, audience);

  // Extract PKP address (will throw if not found)
  const pkpAddress = extractPkpAddress(decodedJWT);

  return { decodedJWT, pkpAddress };
}

/**
 * Check if JWT is expired
 *
 * @param decodedJWT - Decoded JWT
 * @returns true if expired
 */
export function isJwtExpired(decodedJWT: DecodedJWT): boolean {
  return Date.now() >= decodedJWT.exp * 1000;
}
```

**Why this design:**
- Defensive extraction tries multiple fields
- Clear error messages aid debugging
- Logger tracks which field was used
- Easy to update once JWT structure verified

**Reference:**
- Vincent JWT SDK: https://github.com/LIT-Protocol/vincent-app-sdk/tree/main/packages/jwt

### 5.2. Frontend Authentication Component

**File: `src/app/components/VincentConnect.tsx`** (NEW)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getWebAuthClient } from '@lit-protocol/vincent-app-sdk/webAuthClient';
import { isExpired } from '@lit-protocol/vincent-app-sdk/jwt';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;

/**
 * Local storage key for JWT
 */
const VINCENT_JWT_KEY = 'VINCENT_AUTH_JWT';

/**
 * Vincent Connect Component
 *
 * Handles JWT-based authentication flow with Vincent
 *
 * Flow:
 * 1. User clicks "Connect Wallet"
 * 2. Redirects to Vincent authorization page
 * 3. User approves in Vincent
 * 4. Redirects back with JWT in URL
 * 5. Component extracts JWT, stores in localStorage
 * 6. Calls backend to verify and store in DB
 *
 * Reference: Vincent WebAuthClient docs
 * https://github.com/LIT-Protocol/vincent-app-sdk/tree/main/packages/webAuthClient
 */

interface VincentConnectProps {
  onAuthComplete: (jwt: string, walletAddress: string) => void;
  onAuthError?: (error: Error) => void;
}

export function VincentConnect({ onAuthComplete, onAuthError }: VincentConnectProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Vincent WebAuthClient
  const [vincentAppClient] = useState(() => {
    const appId = process.env.NEXT_PUBLIC_VINCENT_APP_ID;
    if (!appId) {
      throw new Error('NEXT_PUBLIC_VINCENT_APP_ID not configured');
    }

    return getWebAuthClient({ appId });
  });

  useEffect(() => {
    async function handleAuthFlow() {
      try {
        // Check if URL contains JWT after redirect
        if (vincentAppClient.uriContainsVincentJWT()) {
          logger.info('Detected JWT in URL after redirect');

          const redirectUri = window.location.origin;
          const { decodedJWT, jwtStr } = vincentAppClient.decodeVincentJWTFromUri(redirectUri);

          // Store JWT in localStorage
          localStorage.setItem(VINCENT_JWT_KEY, jwtStr);

          // Remove JWT from URL (clean up)
          vincentAppClient.removeVincentJWTFromURI();

          // Verify JWT with backend
          await verifyJwtWithBackend(jwtStr);

          return;
        }

        // Check for existing JWT in localStorage
        const storedJwt = localStorage.getItem(VINCENT_JWT_KEY);
        if (storedJwt) {
          // Check if expired
          const expired = isExpired(storedJwt);

          if (!expired) {
            logger.info('Found valid JWT in localStorage');
            await verifyJwtWithBackend(storedJwt);
            return;
          } else {
            logger.info('Stored JWT expired, clearing');
            localStorage.removeItem(VINCENT_JWT_KEY);
          }
        }

        // No valid JWT found
        setIsLoading(false);
      } catch (err) {
        logger.error({ err }, 'Auth flow error');
        const error = err instanceof Error ? err : new Error('Authentication failed');
        setError(error.message);
        onAuthError?.(error);
        setIsLoading(false);
      }
    }

    handleAuthFlow();
  }, [vincentAppClient, onAuthComplete, onAuthError]);

  /**
   * Verify JWT with backend
   * Backend validates signature and stores in DB
   */
  async function verifyJwtWithBackend(jwt: string): Promise<void> {
    try {
      const response = await fetch('/api/vincent/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwt }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'JWT verification failed');
      }

      const data = await response.json();
      logger.info({ walletAddress: data.walletAddress }, 'JWT verified successfully');

      onAuthComplete(jwt, data.walletAddress);
      setIsLoading(false);
    } catch (err) {
      logger.error({ err }, 'Backend JWT verification failed');
      localStorage.removeItem(VINCENT_JWT_KEY);
      throw err;
    }
  }

  /**
   * Initiate Vincent authorization flow
   * Redirects to Vincent authorization page
   */
  function handleConnect() {
    try {
      setIsConnecting(true);
      setError(null);

      // Redirect to Vincent for authorization
      vincentAppClient.redirectToConnectPage({
        redirectUri: window.location.href,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to initiate Vincent auth');
      setError('Failed to connect to Vincent');
      setIsConnecting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span>Checking authentication...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConnecting ? 'Connecting...' : 'Connect Vincent Wallet'}
      </button>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-semibold">Authentication Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <p className="text-sm text-gray-600">
        Connect your Vincent wallet to enable autonomous agent purchases
      </p>
    </div>
  );
}
```

**Why this design:**
- Uses Vincent's official WebAuthClient
- Handles redirect flow automatically
- Stores JWT in localStorage for persistence
- Verifies JWT with backend for security
- Clear loading/error states

**Reference:**
- Vincent WebAuthClient: https://github.com/LIT-Protocol/vincent-app-sdk/tree/main/packages/webAuthClient

---

## 6. Vincent Ability Integration

### 6.1. Ability Client Setup

**File: `src/lib/vincent/abilityClient.ts`** (NEW)

```typescript
import { getVincentAbilityClient } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { bundledVincentAbility as erc20ApprovalAbility } from '@lit-protocol/vincent-ability-erc20-approval';
import { bundledVincentAbility as uniswapSwapAbility } from '@lit-protocol/vincent-ability-uniswap-swap';
import { bundledVincentAbility as evmTxSignerAbility } from '@lit-protocol/vincent-ability-evm-transaction-signer';
import { ethers } from 'ethers';
import { VINCENT_CONFIG } from './config';

/**
 * Vincent Ability Client Factory
 *
 * Creates typed ability clients for blockchain operations
 *
 * IMPORTANT: The ethersSigner uses app's private key for authenticating
 * with Vincent SDK, NOT for signing user transactions. User transactions
 * are signed by Vincent using the delegated PKP wallet.
 *
 * Reference: Vincent Ability SDK docs
 * https://github.com/LIT-Protocol/vincent-abilities
 */

/**
 * Create Ethers signer for Vincent SDK authentication
 * NOT used for user transaction signing
 */
function createEthersSigner(): ethers.Wallet {
  return new ethers.Wallet(VINCENT_CONFIG.appPrivateKey);
}

/**
 * Get ERC-20 Approval Ability Client
 *
 * Used for token approvals (though Nexus handles this via hooks)
 */
export function getErc20ApprovalClient() {
  return getVincentAbilityClient({
    bundledVincentAbility: erc20ApprovalAbility,
    ethersSigner: createEthersSigner(),
  });
}

/**
 * Get Uniswap Swap Ability Client
 *
 * Used for PyUSD → USDC swaps on Uniswap V3
 */
export function getUniswapSwapClient() {
  return getVincentAbilityClient({
    bundledVincentAbility: uniswapSwapAbility,
    ethersSigner: createEthersSigner(),
  });
}

/**
 * Get EVM Transaction Signer Ability Client
 *
 * Used by VincentProvider to sign transactions with user's PKP
 */
export function getEvmTxSignerClient() {
  return getVincentAbilityClient({
    bundledVincentAbility: evmTxSignerAbility,
    ethersSigner: createEthersSigner(),
  });
}

/**
 * Type Definitions for Ability Parameters
 */

export interface Erc20ApprovalParams {
  rpcUrl: string;
  chainId: number;
  spenderAddress: string;
  tokenAddress: string;
  tokenDecimals: number;
  tokenAmount: number; // Human-readable (100 = 100 tokens)
}

export interface UniswapSwapParams {
  rpcUrl: string;
  chainId: number;
  tokenInAddress: string;
  tokenInDecimals: number;
  tokenOutAddress: string;
  tokenOutDecimals: number;
  amountIn: number; // Human-readable
  slippageTolerance: number; // Percentage (0.5 = 0.5%)
  recipient: string;
}

export interface EvmTxSignerParams {
  chainId: number;
  rpcUrl: string;
  signer: string; // PKP wallet address
  rawTransaction: string; // Unsigned tx hex
}
```

**Why this design:**
- Separate clients for each ability (single responsibility)
- Type-safe parameter interfaces
- Clear documentation about signer usage
- Easy to mock for testing

**Reference:**
- Vincent Abilities: https://github.com/LIT-Protocol/vincent-abilities

### 6.2. Wallet Service

**File: `src/lib/vincent/wallet.service.ts`** (NEW)

```typescript
import { getUniswapSwapClient, type UniswapSwapParams } from './abilityClient';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { VINCENT_CONFIG } from './config';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;
const prisma = getPrismaClient();

/**
 * Vincent Wallet Service
 *
 * Business logic wrapper for Vincent abilities
 * Implements precheck → execute pattern with proof storage
 *
 * Reference: Vincent Ability SDK - Precheck/Execute pattern
 * https://github.com/LIT-Protocol/vincent-abilities#usage-pattern
 */
export class VincentWalletService {
  /**
   * Get Vincent auth for agent
   * Validates auth exists and not expired
   */
  private async getAuth(agentId: string) {
    const auth = await prisma.vincentAuth.findFirst({
      where: { agentId },
    });

    if (!auth) {
      throw new Error(`No Vincent auth found for agent ${agentId}`);
    }

    if (auth.expiresAt < new Date()) {
      throw new Error(`Vincent auth expired for agent ${agentId}`);
    }

    return auth;
  }

  /**
   * Swap PyUSD → USDC using Uniswap V3
   *
   * Uses Vincent Uniswap swap ability
   * Follows precheck → execute pattern
   *
   * @param agentId - Agent performing swap
   * @param params - Swap parameters
   * @returns Swap result with output amount and tx hash
   */
  async swapPyusdToUsdc(
    agentId: string,
    params: {
      chainId: number;
      amountIn: number; // Human-readable (100 = 100 PYUSD)
      slippageTolerance?: number;
    }
  ): Promise<{
    amountOut: number;
    swapTxHash: string;
  }> {
    const auth = await this.getAuth(agentId);
    const client = getUniswapSwapClient();

    // Get chain config
    const chainConfig =
      params.chainId === 11155111
        ? VINCENT_CONFIG.chains.ethereumSepolia
        : VINCENT_CONFIG.chains.arbitrumSepolia;

    const swapParams: UniswapSwapParams = {
      rpcUrl: chainConfig.rpcUrl,
      chainId: params.chainId,
      tokenInAddress: chainConfig.tokens.pyusd.address,
      tokenInDecimals: chainConfig.tokens.pyusd.decimals,
      tokenOutAddress: chainConfig.tokens.usdc.address,
      tokenOutDecimals: chainConfig.tokens.usdc.decimals,
      amountIn: params.amountIn,
      slippageTolerance: params.slippageTolerance || 0.5,
      recipient: auth.walletAddress,
    };

    logger.info({ agentId, swapParams }, 'Starting PyUSD → USDC swap');

    // Precheck: Validate swap can execute
    const precheckResult = await client.precheck(swapParams, {
      delegatorPkpEthAddress: auth.walletAddress,
    });

    if (!precheckResult.success) {
      logger.error({ precheckResult }, 'Swap precheck failed');
      throw new Error(precheckResult.result?.reason || 'Swap precheck failed');
    }

    logger.info({ precheckResult }, 'Swap precheck passed');

    // Execute: Perform swap
    const executeResult = await client.execute(swapParams, {
      delegatorPkpEthAddress: auth.walletAddress,
    });

    if (!executeResult.success) {
      logger.error({ executeResult }, 'Swap execution failed');
      throw new Error(executeResult.result?.error || 'Swap failed');
    }

    logger.info(
      {
        amountOut: executeResult.result.amountOut,
        swapTxHash: executeResult.result.swapTxHash,
      },
      'Swap executed successfully'
    );

    // Store proof of agent action
    await prisma.proof.create({
      data: {
        type: 'AGENT_DECISION',
        hash: executeResult.result.swapTxHash,
        agentId,
        data: {
          action: 'SWAP_PYUSD_TO_USDC',
          params: swapParams,
          result: executeResult.result,
        },
        signature: executeResult.result.swapTxHash,
        verified: true,
      },
    });

    return {
      amountOut: executeResult.result.amountOut,
      swapTxHash: executeResult.result.swapTxHash,
    };
  }

  /**
   * Get PKP wallet address for agent
   *
   * @param agentId - Agent ID
   * @returns PKP wallet address
   */
  async getWalletAddress(agentId: string): Promise<string> {
    const auth = await this.getAuth(agentId);
    return auth.walletAddress;
  }
}
```

**Why this design:**
- Precheck before execute (fail fast)
- Store proofs for auditability
- Validate auth and expiration
- Clear error messages

**Reference:**
- Vincent Uniswap Swap Ability: https://github.com/LIT-Protocol/vincent-abilities/tree/main/packages/uniswap-swap

---

## 7. Vincent Provider for Nexus

### 7.1. EIP-1193 Provider Implementation

**File: `src/lib/vincent/provider.ts`** (NEW)

```typescript
import {
  createPublicClient,
  http,
  type Chain,
  type EIP1193Provider,
  Transaction,
} from 'viem';
import { getEvmTxSignerClient, type EvmTxSignerParams } from './abilityClient';
import { VINCENT_CONFIG } from './config';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;

/**
 * Vincent-Backed EIP-1193 Provider
 *
 * CRITICAL: This provider does NOT sign transactions with app's private key.
 * Instead, it calls Vincent's EVM transaction signer ability to sign
 * transactions using the user's delegated PKP wallet.
 *
 * How it works:
 * 1. Nexus SDK calls eth_sendTransaction with unsigned tx params
 * 2. Provider serializes unsigned transaction
 * 3. Provider calls Vincent EVM transaction signer ability
 * 4. Vincent signs tx using user's PKP (via Lit Actions)
 * 5. Provider broadcasts signed transaction
 * 6. Transaction originates from user's PKP wallet (NOT app wallet)
 *
 * Why this is correct:
 * - User authorized app via JWT to act as delegatee
 * - Vincent ability uses Lit Actions to sign with delegated PKP
 * - Transaction broadcasts from user's PKP wallet address
 * - App never directly controls user's private keys
 * - Follows Vincent's security model
 *
 * Reference:
 * - EIP-1193: https://eips.ethereum.org/EIPS/eip-1193
 * - Vincent EVM Transaction Signer: https://github.com/LIT-Protocol/vincent-abilities/tree/main/packages/evm-transaction-signer
 */

export interface VincentProviderConfig {
  walletAddress: string; // User's PKP wallet address from JWT
  chainId: number;
  rpcUrl: string;
}

export class VincentProvider implements EIP1193Provider {
  private walletAddress: string;
  private chainId: number;
  private rpcUrl: string;
  private chain: Chain;
  private evmSignerClient: ReturnType<typeof getEvmTxSignerClient>;

  constructor(config: VincentProviderConfig) {
    this.walletAddress = config.walletAddress;
    this.chainId = config.chainId;
    this.rpcUrl = config.rpcUrl;
    this.chain = this.getChainConfig(config.chainId);

    // Initialize EVM transaction signer ability client
    // App authenticates with Vincent, but Vincent signs using user's PKP
    this.evmSignerClient = getEvmTxSignerClient();

    logger.info(
      {
        walletAddress: this.walletAddress,
        chainId: this.chainId,
      },
      'VincentProvider initialized'
    );
  }

  private getChainConfig(chainId: number): Chain {
    const chains: Record<number, Chain> = {
      11155111: {
        id: 11155111,
        name: 'Ethereum Sepolia',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [this.rpcUrl] },
          public: { http: [this.rpcUrl] },
        },
      },
      421614: {
        id: 421614,
        name: 'Arbitrum Sepolia',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [this.rpcUrl] },
          public: { http: [this.rpcUrl] },
        },
      },
    };

    const chain = chains[chainId];
    if (!chain) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    return chain;
  }

  async request({ method, params }: { method: string; params?: any[] }): Promise<any> {
    logger.debug({ method, params }, 'Provider request');

    switch (method) {
      // Account methods
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [this.walletAddress];

      case 'eth_chainId':
        return `0x${this.chainId.toString(16)}`;

      case 'net_version':
        return this.chainId.toString();

      // Transaction sending (CRITICAL SECTION)
      case 'eth_sendTransaction': {
        const [txParams] = params as [any];

        logger.info({ txParams }, 'Signing transaction via Vincent PKP');

        /**
         * CRITICAL: Vincent EVM Transaction Signing
         *
         * This is the correct way to sign transactions:
         * 1. Serialize unsigned transaction
         * 2. Call Vincent EVM transaction signer ability
         *    - Vincent signs using user's delegated PKP (NOT app wallet)
         *    - Uses JWT authorization from user
         * 3. Broadcast the signed transaction
         *
         * Why this works:
         * - User authorized app via JWT to act as delegatee
         * - Vincent ability uses Lit Actions to sign with PKP
         * - Transaction broadcasts from user's PKP wallet address
         * - App never directly controls user's private keys
         */

        // Step 1: Serialize unsigned transaction
        const unsignedTx = Transaction.from({
          to: txParams.to,
          value: txParams.value ? BigInt(txParams.value) : 0n,
          data: txParams.data || '0x',
          gas: txParams.gas ? BigInt(txParams.gas) : undefined,
          gasPrice: txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined,
          maxFeePerGas: txParams.maxFeePerGas ? BigInt(txParams.maxFeePerGas) : undefined,
          maxPriorityFeePerGas: txParams.maxPriorityFeePerGas
            ? BigInt(txParams.maxPriorityFeePerGas)
            : undefined,
          nonce: txParams.nonce,
          chainId: this.chainId,
        });

        // Get raw unsigned transaction bytes
        const unsignedSerialized = unsignedTx.unsignedSerialized;

        logger.info(
          {
            to: txParams.to,
            value: txParams.value,
            chainId: this.chainId,
          },
          'Step 1: Transaction serialized'
        );

        // Step 2: Call Vincent EVM transaction signer ability
        // This signs using the user's PKP wallet (NOT app wallet)
        const signerParams: EvmTxSignerParams = {
          chainId: this.chainId,
          rpcUrl: this.rpcUrl,
          signer: this.walletAddress, // User's PKP wallet address
          rawTransaction: unsignedSerialized, // Unsigned tx bytes
        };

        logger.info('Step 2: Calling Vincent EVM transaction signer ability');

        const signResult = await this.evmSignerClient.execute(signerParams, {
          // CRITICAL: This tells Vincent to sign using the delegated PKP
          // that the user authorized via JWT
          delegatorPkpEthAddress: this.walletAddress,
        });

        if (!signResult.success) {
          logger.error({ signResult }, 'Vincent PKP signing failed');
          throw new Error(
            signResult.result?.error || 'Transaction signing failed via Vincent PKP'
          );
        }

        logger.info(
          {
            signedTx: signResult.result.signedTransaction.slice(0, 20) + '...',
          },
          'Step 2 complete: Transaction signed by Vincent PKP'
        );

        // Step 3: Broadcast signed transaction
        const publicClient = createPublicClient({
          transport: http(this.rpcUrl),
          chain: this.chain,
        });

        logger.info('Step 3: Broadcasting signed transaction');

        const txHash = await publicClient.sendRawTransaction({
          serializedTransaction: signResult.result.signedTransaction as `0x${string}`,
        });

        logger.info(
          {
            txHash,
            from: this.walletAddress,
            to: txParams.to,
          },
          'Step 3 complete: Transaction broadcasted successfully'
        );

        return txHash;
      }

      // Read-only methods - proxy to RPC
      case 'eth_getBalance':
      case 'eth_getTransactionCount':
      case 'eth_call':
      case 'eth_estimateGas':
      case 'eth_getCode':
      case 'eth_getStorageAt':
      case 'eth_blockNumber':
      case 'eth_getBlockByNumber':
      case 'eth_getBlockByHash':
      case 'eth_getTransactionByHash':
      case 'eth_getTransactionReceipt':
      case 'eth_getLogs': {
        const publicClient = createPublicClient({
          transport: http(this.rpcUrl),
          chain: this.chain,
        });
        return publicClient.request({ method, params } as any);
      }

      default:
        throw new Error(`Method ${method} not supported by VincentProvider`);
    }
  }

  // EIP-1193 event methods (required by interface)
  on(event: string, listener: (...args: any[]) => void): void {
    // No-op: We don't emit events in this implementation
    logger.debug({ event }, 'Event listener registered (no-op)');
  }

  removeListener(event: string, listener: (...args: any[]) => void): void {
    // No-op
    logger.debug({ event }, 'Event listener removed (no-op)');
  }
}

/**
 * Factory function to create Vincent-backed provider for Nexus SDK
 *
 * @param config - Provider configuration
 * @returns EIP-1193 provider that signs using Vincent PKP
 */
export async function createVincentProviderForNexus(config: {
  walletAddress: string;
  chainId: number;
}): Promise<EIP1193Provider> {
  const rpcUrl =
    config.chainId === 11155111
      ? VINCENT_CONFIG.chains.ethereumSepolia.rpcUrl
      : VINCENT_CONFIG.chains.arbitrumSepolia.rpcUrl;

  return new VincentProvider({
    walletAddress: config.walletAddress,
    chainId: config.chainId,
    rpcUrl,
  });
}
```

**Why this design:**
- Signs transactions with Vincent PKP (NOT app wallet) ✅
- Uses Vincent EVM transaction signer ability
- Implements full EIP-1193 spec
- Clear logging for debugging
- Proxies read-only methods to RPC

**Reference:**
- EIP-1193 Standard: https://eips.ethereum.org/EIPS/eip-1193
- Vincent EVM Transaction Signer: https://github.com/LIT-Protocol/vincent-abilities/tree/main/packages/evm-transaction-signer

---

## 8. Nexus SDK Integration

### 8.1. Nexus Service

**File: `src/lib/nexus/service.ts`** (NEW)

```typescript
import { NexusSDK, NEXUS_EVENTS } from '@avail-project/nexus-core';
import { createVincentProviderForNexus } from '@/lib/vincent/provider';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.nexus;
const prisma = getPrismaClient();

/**
 * Nexus SDK Service for cross-chain transfers
 *
 * CRITICAL: Does NOT manually approve tokens.
 * Instead, uses Nexus SDK's allowance hook system.
 *
 * How allowance hooks work:
 * 1. Nexus detects approval needed for transfer
 * 2. Nexus calls setOnAllowanceHook with sources array
 * 3. Each source contains: token, spender, amount needed
 * 4. Agent calls allow(['min'])
 * 5. Nexus SDK executes approval transaction via VincentProvider
 * 6. VincentProvider calls Vincent EVM tx signer
 * 7. Approval signed by user's PKP wallet
 * 8. Nexus proceeds with transfer
 *
 * Why this is correct:
 * - Nexus knows exact spender addresses (internal routers)
 * - Nexus calculates exact amounts (transfer + fees)
 * - 'min' approval = most secure (no unlimited approvals)
 * - No need to hardcode spender addresses
 *
 * Reference: Nexus Core API docs
 * https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference
 */
export class NexusService {
  private sdk: NexusSDK;
  private initialized = false;

  constructor(network: 'mainnet' | 'testnet' = 'testnet') {
    this.sdk = new NexusSDK({ network });
    logger.info({ network }, 'Nexus SDK instance created');
  }

  /**
   * Initialize Nexus SDK with Vincent-backed provider
   *
   * @param params - Initialization parameters
   */
  async initialize(params: {
    walletAddress: string;
    sourceChainId: number;
  }): Promise<void> {
    logger.info({ params }, 'Initializing Nexus SDK');

    // Create Vincent-backed provider
    // This provider signs transactions using user's PKP wallet
    const provider = await createVincentProviderForNexus({
      walletAddress: params.walletAddress,
      chainId: params.sourceChainId,
    });

    // Initialize SDK with provider
    await this.sdk.initialize(provider);
    this.initialized = true;

    // Setup hooks for autonomous operation
    this.setupHooks();
    this.setupEventListeners();

    logger.info('Nexus SDK initialized successfully');
  }

  /**
   * Setup Nexus SDK hooks for autonomous agent operation
   *
   * These hooks allow the agent to automatically:
   * 1. Approve cross-chain intents
   * 2. Handle token approvals (WITHOUT manual calls)
   */
  private setupHooks(): void {
    /**
     * Hook 1: Auto-approve cross-chain intents
     *
     * Nexus calls this when about to execute a cross-chain transfer
     * Agent can inspect intent and decide to allow/deny
     *
     * For autonomous agents, we auto-approve all intents
     */
    this.sdk.setOnIntentHook(({ intent, allow, deny, refresh }) => {
      logger.info(
        {
          token: intent.token,
          amount: intent.amount,
          toChain: intent.chainId,
        },
        'Intent hook triggered - auto-approving'
      );

      // Agent policy: Auto-approve all intents
      // In production, you might want policy checks here:
      // - Validate amount within spending limits
      // - Check recipient is authorized
      // - Verify chain is allowed
      allow();
    });

    /**
     * Hook 2: Auto-approve token allowances
     *
     * CRITICAL: This is where approvals happen - NOT manual calls!
     *
     * How it works:
     * 1. Nexus determines what approvals are needed
     * 2. SDK calls this hook with sources array
     * 3. Each source contains: token, spender, amount required
     * 4. Calling allow(['min']) tells Nexus to configure exact approvals
     * 5. Nexus SDK executes approval transactions via the provider
     * 6. Provider uses Vincent to sign approvals with user's PKP
     *
     * Why allow(['min'])?
     * - 'min' means approve only the minimum amount needed
     * - Nexus calculates this based on the transfer amount + fees
     * - More secure than unlimited approvals
     * - No need to know spender addresses or amounts
     *
     * Reference: Nexus Core API - setOnAllowanceHook
     * https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference#setonallowancehook
     */
    this.sdk.setOnAllowanceHook(({ sources, allow, deny }) => {
      logger.info(
        {
          allowances: sources.map((s) => ({
            token: s.token,
            chain: s.chainId,
            spender: s.spender,
            amountNeeded: s.amount,
          })),
        },
        'Allowance hook triggered - auto-approving min amounts'
      );

      // Agent policy: Auto-approve minimum required allowances
      // Nexus handles spender addresses and exact amounts internally
      allow(['min']);
    });

    logger.info('Nexus hooks configured for autonomous operation');
  }

  /**
   * Setup event listeners for transaction tracking
   */
  private setupEventListeners(): void {
    // Listen for transaction step completions
    this.sdk.nexusEvents.on(NEXUS_EVENTS.STEP_COMPLETE, async (step) => {
      logger.info(
        {
          stepType: step.data.type,
          txHash: step.data.transactionHash,
          success: !step.data.error,
        },
        'Nexus step completed'
      );

      // Update transaction status in database
      if (step.data.transactionHash) {
        await prisma.transaction.updateMany({
          where: { hash: step.data.transactionHash },
          data: {
            status: step.data.error ? 'FAILED' : 'CONFIRMED',
            confirmedAt: new Date(),
            errorMessage: step.data.error || null,
            blockNumber: step.data.blockNumber ? BigInt(step.data.blockNumber) : null,
          },
        });
      }
    });

    // Listen for route selections
    this.sdk.nexusEvents.on(NEXUS_EVENTS.ROUTE_SELECTED, (route) => {
      logger.info(
        {
          routeId: route.data.id,
          steps: route.data.steps?.length,
          estimatedTime: route.data.estimatedTime,
        },
        'Nexus route selected'
      );
    });

    // Listen for errors
    this.sdk.nexusEvents.on(NEXUS_EVENTS.ERROR, (error) => {
      logger.error(
        {
          errorType: error.data.type,
          message: error.data.message,
        },
        'Nexus error occurred'
      );
    });

    logger.info('Nexus event listeners configured');
  }

  /**
   * Execute cross-chain USDC transfer
   *
   * NO manual approval needed - handled by allowance hook!
   *
   * Flow:
   * 1. Call sdk.transfer()
   * 2. Nexus calculates optimal route
   * 3. If approval needed, calls allowance hook
   * 4. Agent auto-approves via allow(['min'])
   * 5. Nexus executes approval tx (via VincentProvider → Vincent PKP)
   * 6. Nexus executes transfer tx (via VincentProvider → Vincent PKP)
   * 7. Nexus handles bridging/routing internally
   * 8. Returns initial tx hash
   *
   * @param params - Transfer parameters
   * @returns Transaction hash of the initial transaction
   */
  async executeTransfer(params: {
    fromChainId: number;
    toChainId: number;
    amount: number; // Human-readable (100 = 100 USDC, NOT 100000000)
    recipient: string;
  }): Promise<string> {
    if (!this.initialized) {
      throw new Error('Nexus SDK not initialized - call initialize() first');
    }

    logger.info({ params }, 'Executing cross-chain USDC transfer');

    /**
     * Execute transfer
     *
     * Nexus will:
     * 1. Calculate optimal route (bridge/swap steps)
     * 2. Call allowance hook if approval needed
     * 3. Execute approval transaction (if needed)
     * 4. Execute transfer transaction
     * 5. Handle bridging/routing internally
     * 6. Emit events for each step
     *
     * All transactions signed by user's PKP via VincentProvider
     */
    const result = await this.sdk.transfer({
      token: 'USDC',
      amount: params.amount, // Human-readable amount
      chainId: params.toChainId,
      recipient: params.recipient,
      sourceChains: [params.fromChainId],
    });

    if (!result.success) {
      logger.error({ result }, 'Nexus transfer failed');
      throw new Error(result.error || 'Cross-chain transfer failed');
    }

    logger.info(
      {
        txHash: result.transactionHash,
        fromChain: params.fromChainId,
        toChain: params.toChainId,
      },
      'Cross-chain transfer initiated successfully'
    );

    return result.transactionHash!;
  }

  /**
   * Get transfer status
   *
   * @param txHash - Initial transaction hash
   * @returns Transfer status
   */
  async getTransferStatus(txHash: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('Nexus SDK not initialized');
    }

    return this.sdk.getTransferStatus(txHash);
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    if (this.initialized) {
      // Remove event listeners
      this.sdk.nexusEvents.removeAllListeners();
      this.initialized = false;
      logger.info('Nexus SDK disconnected');
    }
  }
}
```

**Why this design:**
- Uses Nexus allowance hooks (NO manual approval) ✅
- Auto-approves intents and allowances for agent autonomy
- Event listeners update transaction status
- Clear separation of concerns

**Reference:**
- Nexus Core API: https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference
- Allowance Hook: https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference#setonallowancehook

---

## 9. Purchase Flow Orchestration

### 9.1. Agent Service

**File: `src/lib/agents/agent.service.ts`** (UPDATED)

```typescript
import { VincentWalletService } from '@/lib/vincent/wallet.service';
import { NexusService } from '@/lib/nexus/service';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.agents;
const prisma = getPrismaClient();

/**
 * Agent Service
 *
 * Orchestrates complete purchase flow
 * Three-step process (NO manual approval step):
 * 1. Swap PyUSD → USDC (Vincent Uniswap ability)
 * 2. Initialize Nexus SDK (with Vincent-backed provider)
 * 3. Execute cross-chain transfer (Nexus handles approvals via hooks)
 */
export class AgentService {
  private walletService = new VincentWalletService();
  private nexusService = new NexusService('testnet');

  /**
   * Execute complete purchase flow
   *
   * Flow:
   * 1. Swap PyUSD → USDC using Vincent Uniswap ability
   * 2. Initialize Nexus with Vincent-backed provider
   * 3. Execute cross-chain USDC transfer
   *    - Nexus calls allowance hook if approval needed
   *    - Agent auto-approves via allow(['min'])
   *    - Nexus executes approval + transfer via VincentProvider
   *    - All transactions signed by user's PKP wallet
   * 4. Record transaction in database
   *
   * @param params - Purchase parameters
   * @returns Transaction hash of the initial transfer transaction
   */
  async executePurchase(params: {
    buyerAgentId: string;
    sellerWalletAddress: string;
    pyusdAmount: number;
    fromChainId: number;
    toChainId: number;
    listingId: string;
  }): Promise<string> {
    const {
      buyerAgentId,
      sellerWalletAddress,
      pyusdAmount,
      fromChainId,
      toChainId,
      listingId,
    } = params;

    logger.info({ params }, 'Starting purchase execution');

    try {
      // Get buyer's PKP wallet address
      const buyerWalletAddress = await this.walletService.getWalletAddress(buyerAgentId);

      logger.info(
        {
          buyerAgentId,
          buyerWalletAddress,
          sellerWalletAddress,
        },
        'Buyer and seller wallets identified'
      );

      // ========================================
      // STEP 1: Swap PyUSD → USDC
      // ========================================
      logger.info({ pyusdAmount, fromChainId }, 'Step 1: Swapping PyUSD to USDC');

      const swapResult = await this.walletService.swapPyusdToUsdc(buyerAgentId, {
        chainId: fromChainId,
        amountIn: pyusdAmount,
        slippageTolerance: 0.5, // 0.5% slippage tolerance
      });

      const usdcAmount = swapResult.amountOut;

      logger.info(
        {
          pyusdIn: pyusdAmount,
          usdcOut: usdcAmount,
          swapTxHash: swapResult.swapTxHash,
        },
        'Step 1 complete: Swap successful'
      );

      // ========================================
      // STEP 2: Initialize Nexus SDK
      // ========================================
      logger.info('Step 2: Initializing Nexus SDK with Vincent provider');

      await this.nexusService.initialize({
        walletAddress: buyerWalletAddress,
        sourceChainId: fromChainId,
      });

      logger.info('Step 2 complete: Nexus SDK initialized');

      // ========================================
      // STEP 3: Execute Cross-Chain Transfer
      // ========================================
      // NOTE: NO manual approval here!
      // Nexus will:
      // 1. Detect USDC approval needed
      // 2. Call our allowance hook
      // 3. We call allow(['min'])
      // 4. Nexus executes approval tx via VincentProvider
      // 5. VincentProvider calls Vincent EVM tx signer
      // 6. Approval signed by user's PKP wallet
      // 7. Nexus executes transfer tx
      logger.info(
        {
          usdcAmount,
          from: buyerWalletAddress,
          to: sellerWalletAddress,
          fromChain: fromChainId,
          toChain: toChainId,
        },
        'Step 3: Executing cross-chain USDC transfer (Nexus handles approvals)'
      );

      const txHash = await this.nexusService.executeTransfer({
        fromChainId,
        toChainId,
        amount: usdcAmount,
        recipient: sellerWalletAddress,
      });

      logger.info({ txHash }, 'Step 3 complete: Cross-chain transfer initiated');

      // ========================================
      // STEP 4: Record Transaction in Database
      // ========================================
      await prisma.transaction.create({
        data: {
          hash: txHash,
          fromAgentId: buyerAgentId,
          listingId,
          amount: BigInt(Math.floor(usdcAmount * 1e6)), // Convert to wei
          token: 'USDC',
          sourceChain: fromChainId,
          destinationChain: toChainId,
          status: 'PENDING',
        },
      });

      logger.info(
        {
          buyerAgentId,
          listingId,
          txHash,
          usdcAmount,
        },
        'Purchase execution complete'
      );

      return txHash;
    } catch (error) {
      logger.error(
        {
          err: error,
          buyerAgentId,
          listingId,
        },
        'Purchase execution failed'
      );

      // Store failed transaction record
      await prisma.proof.create({
        data: {
          type: 'AGENT_DECISION',
          hash: `failed-${Date.now()}`,
          agentId: buyerAgentId,
          data: {
            action: 'PURCHASE_FAILED',
            params,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          signature: '',
          verified: false,
        },
      });

      throw error;
    }
  }

  /**
   * Get purchase status
   *
   * @param txHash - Transaction hash
   * @returns Purchase status with Nexus transfer info
   */
  async getPurchaseStatus(txHash: string): Promise<any> {
    const transaction = await prisma.transaction.findUnique({
      where: { hash: txHash },
      include: {
        fromAgent: true,
        toAgent: true,
        listing: true,
      },
    });

    if (!transaction) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    // Get Nexus transfer status
    const nexusStatus = await this.nexusService.getTransferStatus(txHash);

    return {
      transaction,
      nexusStatus,
    };
  }
}
```

**Why this design:**
- Three-step flow (removed manual approval) ✅
- Clear logging at each step
- Error handling with proof storage
- Database tracking

---

## 10. API Routes

### 10.1. JWT Verification Endpoint

**File: `src/app/api/vincent/auth/verify/route.ts`** (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyVincentJWT } from '@/lib/vincent/jwt.service';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;
const prisma = getPrismaClient();

/**
 * POST /api/vincent/auth/verify
 *
 * Verifies Vincent JWT and stores auth in database
 *
 * Body: { jwt: string }
 * Returns: { success: boolean, walletAddress: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();

    if (!jwt || typeof jwt !== 'string') {
      return NextResponse.json({ error: 'JWT required' }, { status: 400 });
    }

    const jwtAudience = process.env.NEXT_PUBLIC_APP_URL;
    if (!jwtAudience) {
      throw new Error('NEXT_PUBLIC_APP_URL not configured');
    }

    logger.info('Verifying Vincent JWT');

    // Verify JWT and extract PKP address
    // Throws if:
    // 1. JWT signature invalid
    // 2. Audience doesn't match
    // 3. JWT expired
    // 4. PKP address not found in expected fields
    const { decodedJWT, pkpAddress } = verifyVincentJWT(jwt, jwtAudience);

    logger.info(
      {
        pkpAddress,
        expiresAt: new Date(decodedJWT.exp * 1000),
      },
      'Vincent JWT verified successfully'
    );

    // Store or update auth in database
    await prisma.vincentAuth.upsert({
      where: { userId: pkpAddress },
      update: {
        walletAddress: pkpAddress,
        authData: decodedJWT as any,
        expiresAt: new Date(decodedJWT.exp * 1000),
        issuedAt: new Date(),
      },
      create: {
        userId: pkpAddress,
        walletAddress: pkpAddress,
        authData: decodedJWT as any,
        expiresAt: new Date(decodedJWT.exp * 1000),
      },
    });

    return NextResponse.json({
      success: true,
      walletAddress: pkpAddress,
    });
  } catch (error) {
    logger.error({ err: error }, 'JWT verification failed');

    // Return specific error messages
    if (error instanceof Error) {
      if (error.message.includes('PKP wallet address not found')) {
        return NextResponse.json(
          {
            error: 'Invalid JWT structure',
            message: error.message,
            hint: 'Check Vincent SDK documentation for correct JWT format',
          },
          { status: 400 }
        );
      }

      if (error.message.includes('expired')) {
        return NextResponse.json(
          { error: 'JWT expired', message: 'Please reconnect your wallet' },
          { status: 401 }
        );
      }

      if (error.message.includes('audience')) {
        return NextResponse.json(
          { error: 'Invalid JWT audience', message: error.message },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Invalid or expired JWT',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 401 }
    );
  }
}
```

### 10.2. Purchase Endpoint

**File: `src/app/api/agents/purchase/route.ts`** (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { AgentService } from '@/lib/agents/agent.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.api;
const agentService = new AgentService();

/**
 * POST /api/agents/purchase
 *
 * Execute agent purchase
 *
 * Body: {
 *   buyerAgentId: string;
 *   sellerWalletAddress: string;
 *   pyusdAmount: number;
 *   fromChainId: number;
 *   toChainId: number;
 *   listingId: string;
 * }
 *
 * Returns: { success: boolean, txHash: string }
 */
export async function POST(req: NextRequest) {
  try {
    const params = await req.json();

    logger.info({ params }, 'Purchase request received');

    // Validate required fields
    const required = [
      'buyerAgentId',
      'sellerWalletAddress',
      'pyusdAmount',
      'fromChainId',
      'toChainId',
      'listingId',
    ];

    for (const field of required) {
      if (!(field in params)) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Execute purchase
    const txHash = await agentService.executePurchase(params);

    return NextResponse.json({
      success: true,
      txHash,
    });
  } catch (error) {
    logger.error({ err: error }, 'Purchase failed');

    return NextResponse.json(
      {
        error: 'Purchase failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

---

## 11. Frontend Components

### 11.1. Agent Dashboard

**File: `src/app/components/AgentDashboard.tsx`** (UPDATED)

```typescript
'use client';

import { useState } from 'react';
import { VincentConnect } from './VincentConnect';

export function AgentDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handleAuthComplete = (jwt: string, address: string) => {
    setIsAuthenticated(true);
    setWalletAddress(address);
  };

  const handlePurchase = async (listingId: string, pyusdAmount: number) => {
    setIsPurchasing(true);

    try {
      const response = await fetch('/api/agents/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerAgentId: walletAddress,
          sellerWalletAddress: '0xSELLER_ADDRESS', // From listing
          pyusdAmount,
          fromChainId: 11155111, // ETH Sepolia
          toChainId: 421614, // Arbitrum Sepolia
          listingId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      alert(`Purchase successful! Tx: ${data.txHash}`);
    } catch (error) {
      alert(`Purchase failed: ${error}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="p-6">
      {!isAuthenticated ? (
        <VincentConnect onAuthComplete={handleAuthComplete} />
      ) : (
        <div>
          <p>Connected: {walletAddress}</p>
          <button
            onClick={() => handlePurchase('listing-1', 100)}
            disabled={isPurchasing}
          >
            {isPurchasing ? 'Purchasing...' : 'Purchase Item'}
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 12. Testing Strategy

### 12.1. Unit Tests

**JWT Service Tests**

```typescript
// src/lib/vincent/__tests__/jwt.service.test.ts
import { describe, test, expect, vi } from 'vitest';
import { extractPkpAddress, verifyVincentJWT } from '../jwt.service';

describe('JWT Service', () => {
  test('extractPkpAddress extracts from sub field', () => {
    const decodedJWT = {
      sub: '0x1234567890123456789012345678901234567890',
      aud: 'http://localhost:3000',
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000,
      iss: 'vincent',
    };

    const address = extractPkpAddress(decodedJWT as any);
    expect(address).toBe('0x1234567890123456789012345678901234567890');
  });

  test('extractPkpAddress throws if no address found', () => {
    const decodedJWT = {
      sub: 'not-an-address',
      aud: 'http://localhost:3000',
      exp: Date.now() / 1000 + 3600,
      iat: Date.now() / 1000,
      iss: 'vincent',
    };

    expect(() => extractPkpAddress(decodedJWT as any)).toThrow(
      'PKP wallet address not found'
    );
  });
});
```

**Vincent Provider Tests**

```typescript
// src/lib/vincent/__tests__/provider.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { VincentProvider } from '../provider';

vi.mock('../abilityClient');
vi.mock('viem');

describe('VincentProvider', () => {
  let provider: VincentProvider;

  beforeEach(() => {
    provider = new VincentProvider({
      walletAddress: '0x1234567890123456789012345678901234567890',
      chainId: 11155111,
      rpcUrl: 'http://localhost:8545',
    });
  });

  test('eth_accounts returns wallet address', async () => {
    const result = await provider.request({ method: 'eth_accounts' });
    expect(result).toEqual(['0x1234567890123456789012345678901234567890']);
  });

  test('eth_chainId returns correct chain ID', async () => {
    const result = await provider.request({ method: 'eth_chainId' });
    expect(result).toBe('0xaa36a7');
  });
});
```

### 12.2. Integration Tests

**Purchase Flow Test**

```typescript
// src/lib/agents/__tests__/agent.service.integration.test.ts
import { describe, test, expect, beforeAll } from 'vitest';
import { AgentService } from '../agent.service';
import { setupTestDatabase } from '@/test/utils';

describe('AgentService Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  test('complete purchase flow', async () => {
    const service = new AgentService();

    const txHash = await service.executePurchase({
      buyerAgentId: 'agent-1',
      sellerWalletAddress: '0xSELLER',
      pyusdAmount: 100,
      fromChainId: 11155111,
      toChainId: 421614,
      listingId: 'listing-1',
    });

    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  }, 60000); // 60s timeout for cross-chain tx
});
```

### 12.3. Test Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| JWT Service | 95% |
| Vincent Provider | 90% |
| Nexus Service | 85% |
| Agent Service | 90% |
| API Routes | 85% |
| Overall | 90% |

---

## 13. Risk Mitigation

### 13.1. Security Risks

| Risk | Mitigation |
|------|-----------|
| **JWT Theft** | Store in httpOnly cookie (production), validate on every request |
| **PKP Key Exposure** | Never expose Vincent PKP keys, only use via abilities |
| **Unlimited Approvals** | Use allow(['min']) for minimum approvals only |
| **Reentrancy** | Vincent abilities are audited, Nexus handles securely |
| **Front-running** | Use slippage protection on swaps |

### 13.2. Operational Risks

| Risk | Mitigation |
|------|-----------|
| **Nexus Service Down** | Implement retry logic, fallback to direct bridge |
| **RPC Failures** | Use multiple RPC providers, failover logic |
| **Gas Price Spikes** | Implement gas price monitoring, pause if > threshold |
| **Insufficient Balance** | Pre-check balances in precheck step |
| **Cross-chain Failure** | Monitor Nexus events, implement timeout/retry |

### 13.3. Data Risks

| Risk | Mitigation |
|------|-----------|
| **JWT Expiration** | Check expiration before operations, prompt re-auth |
| **Database Downtime** | Queue operations, retry on reconnect |
| **Transaction History Loss** | Backup database, query on-chain as fallback |

---

## 14. References

### 14.1. Documentation

| Resource | URL |
|----------|-----|
| **Vincent SDK** | https://github.com/LIT-Protocol/vincent-app-sdk |
| **Vincent Abilities** | https://github.com/LIT-Protocol/vincent-abilities |
| **Vincent JWT** | https://github.com/LIT-Protocol/vincent-app-sdk/tree/main/packages/jwt |
| **Vincent WebAuthClient** | https://github.com/LIT-Protocol/vincent-app-sdk/tree/main/packages/webAuthClient |
| **Nexus Core SDK** | https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference |
| **Nexus Allowance Hook** | https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference#setonallowancehook |
| **EIP-1193** | https://eips.ethereum.org/EIPS/eip-1193 |
| **Viem** | https://viem.sh/ |

### 14.2. Contract Addresses

| Network | Token | Address |
|---------|-------|---------|
| ETH Sepolia | PyUSD | `0x513421d7fb6A74AE51f3812826Aa2Db99a68F2C9` |
| ETH Sepolia | USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| ETH Sepolia | Uniswap Router | `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` |
| Arb Sepolia | PyUSD | `0xc6006A919685EA081697613373C50B6b46cd6F11` |
| Arb Sepolia | USDC | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |

### 14.3. Chain IDs

| Network | Chain ID | Identifier |
|---------|----------|------------|
| Ethereum Sepolia | 11155111 | `ethereumSepolia` |
| Arbitrum Sepolia | 421614 | `arbitrumSepolia` |

---

## 15. Implementation Timeline

### Phase 1: Foundation (2 hours)

- [ ] Setup environment variables
- [ ] Create config module
- [ ] Update database schema + migration
- [ ] Create JWT verification service
- [ ] Unit tests for JWT service

### Phase 2: Vincent Integration (3 hours)

- [ ] Create Vincent ability clients
- [ ] Implement VincentWalletService
- [ ] **CRITICAL:** Implement VincentProvider with EVM tx signer
- [ ] Unit tests for Vincent components
- [ ] Integration test for swap

### Phase 3: Nexus Integration (2 hours)

- [ ] Implement NexusService
- [ ] Setup allowance hooks
- [ ] Setup event listeners
- [ ] Unit tests for Nexus service

### Phase 4: Purchase Orchestration (2 hours)

- [ ] Update AgentService with purchase flow
- [ ] Create API routes (auth/verify, agents/purchase)
- [ ] Integration test for complete purchase
- [ ] Error handling and logging

### Phase 5: Frontend (2 hours)

- [ ] Create VincentConnect component
- [ ] Update AgentDashboard
- [ ] Test authentication flow
- [ ] Test purchase flow end-to-end

### Phase 6: Testing & Documentation (1 hour)

- [ ] Complete test coverage
- [ ] Update documentation
- [ ] Create troubleshooting guide
- [ ] Final review

**Total Estimated Time:** 12 hours

---

## Appendix A: JWT Field Verification Action Items

**TODO: Verify JWT structure before production deployment**

1. **Test Authentication Flow:**
   ```typescript
   // Add debug endpoint temporarily
   // POST /api/vincent/auth/debug
   export async function POST(req: NextRequest) {
     const { jwt } = await req.json();
     const decoded = verify(jwt, process.env.NEXT_PUBLIC_APP_URL!);

     return NextResponse.json({
       allFields: Object.keys(decoded),
       sub: decoded.sub,
       fullJWT: decoded,
     });
   }
   ```

2. **Inspect JWT Structure:**
   - Run Vincent authorization flow
   - Get actual JWT after redirect
   - POST JWT to debug endpoint
   - Inspect response to see all fields

3. **Update extractPkpAddress():**
   - Once correct field identified
   - Update function in `jwt.service.ts`
   - Remove defensive fallbacks
   - Update tests

4. **Remove Debug Endpoint:**
   - Delete debug endpoint before production
   - Security: Don't expose JWT fields in production

---

## Appendix B: Key Architectural Decisions

### B.1. Why Vincent EVM Transaction Signer?

**Problem:** Need to sign transactions from user's PKP wallet, not app wallet.

**Solution:** Use Vincent EVM transaction signer ability.

**Why this works:**
- User authorizes app via JWT to act as delegatee
- Vincent ability uses Lit Actions to sign with delegated PKP
- Transaction broadcasts from user's PKP wallet address
- App never directly controls user's private keys
- Follows Vincent's security model

**Why NOT direct app key signing:**
- Would sign from app wallet, not user wallet
- Defeats purpose of Vincent delegation
- Security violation
- Authorization bypass

### B.2. Why Nexus Allowance Hooks?

**Problem:** Need to approve USDC before transfer, but don't know spender address.

**Solution:** Use Nexus `setOnAllowanceHook` with `allow(['min'])`.

**Why this works:**
- Nexus knows exact spender addresses (internal routers)
- Nexus calculates exact amounts (transfer + fees)
- 'min' approval = most secure (no unlimited approvals)
- No need to hardcode spender addresses
- Nexus executes approval automatically

**Why NOT manual approval:**
- Don't know Nexus spender addresses
- Can't calculate exact amount needed
- Would need to hardcode addresses (breaks on updates)
- More complex and error-prone

### B.3. Why Three-Step Flow?

**Problem:** PyUSD → cross-chain USDC transfer.

**Solution:** Swap → Initialize → Transfer.

**Why this works:**
- Nexus doesn't support PyUSD
- Uniswap swap converts PyUSD → USDC
- Nexus handles cross-chain USDC transfer
- Each step has clear responsibility

**Why NOT four-step with manual approval:**
- Nexus handles approvals via hooks
- Manual approval adds complexity
- Would need to know spender address
- Hooks are the correct Nexus pattern

---

## Conclusion

This technical specification provides a complete, production-ready implementation plan for Vincent + Nexus integration in Dan's List. Key revisions from initial plan:

1. **✅ Provider Signing:** Uses Vincent EVM transaction signer ability (NOT app key)
2. **✅ Approval Handling:** Uses Nexus allowance hooks (NOT manual approval)
3. **✅ JWT Verification:** Defensive extraction with action items for verification

The plan is ready for senior engineer review and implementation. All critical architectural decisions are documented with clear reasoning and references to official documentation.

**Estimated Implementation Time:** 12 hours

**Test Coverage Goal:** 90%

**Status:** Ready for Implementation ✅
