# Phase 4 Vincent + Nexus Integration - Critical Revisions

## Overview

This document addresses critical feedback on the initial technical specification:

1. **Provider Signing Logic** - Fixed to use Vincent EVM transaction signer ability
2. **Approval Handling** - Removed manual approval, using Nexus hooks instead
3. **JWT Field Verification** - Added implementation strategy

---

## 1. CRITICAL FIX: VincentProvider Signing Logic

### Problem Identified

**Original (WRONG) Implementation:**
```typescript
// ❌ Signs with app's private key - broadcasts from app wallet, NOT user's PKP wallet
async request({ method, params }) {
  case 'eth_sendTransaction': {
    const [txParams] = params;
    const walletClient = createWalletClient({
      account: privateKeyToAccount(appPrivateKey), // WRONG: Uses app wallet
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
    const hash = await walletClient.sendTransaction(txParams);
    return hash;
  }
}
```

**Why This is Wrong:**
- Transactions broadcast from app wallet address, not the user's Vincent PKP wallet
- Defeats the entire purpose of Vincent's delegatee pattern
- User's JWT authorization is bypassed
- Security violation: app wallet signs everything, not the delegated PKP

### Corrected Implementation

**File: `src/lib/vincent/provider.ts`**

```typescript
import { createPublicClient, http, type Chain, type EIP1193Provider } from 'viem';
import { Transaction, encodeAbiParameters } from 'viem';
import { getVincentAbilityClient } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { bundledVincentAbility as evmTxSignerAbility } from '@lit-protocol/vincent-ability-evm-transaction-signer';
import { ethers } from 'ethers';
import { VINCENT_CONFIG } from './config';

/**
 * EIP-1193 Provider for Nexus SDK backed by Vincent PKP wallet
 *
 * CRITICAL: This provider does NOT sign with app's private key.
 * Instead, it calls Vincent's EVM transaction signer ability to sign
 * transactions using the user's delegated PKP wallet.
 *
 * Reference: Vincent Ability SDK docs
 * https://github.com/LIT-Protocol/vincent-abilities
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
  private evmSignerClient: ReturnType<typeof getVincentAbilityClient>;

  constructor(config: VincentProviderConfig) {
    this.walletAddress = config.walletAddress;
    this.chainId = config.chainId;
    this.rpcUrl = config.rpcUrl;
    this.chain = this.getChainConfig(config.chainId);

    // Initialize EVM transaction signer ability client
    // App uses its private key to authenticate WITH Vincent, but Vincent
    // signs transactions using the user's delegated PKP
    this.evmSignerClient = getVincentAbilityClient({
      bundledVincentAbility: evmTxSignerAbility,
      ethersSigner: this.createEthersSigner(),
    });
  }

  private createEthersSigner(): ethers.Wallet {
    // This signer is ONLY for authenticating with Vincent SDK
    // NOT for signing user transactions
    return new ethers.Wallet(VINCENT_CONFIG.appPrivateKey);
  }

  private getChainConfig(chainId: number): Chain {
    // Chain configurations
    const chains = {
      11155111: { id: 11155111, name: 'Ethereum Sepolia' },
      421614: { id: 421614, name: 'Arbitrum Sepolia' },
    };
    return chains[chainId as keyof typeof chains] as Chain;
  }

  async request({ method, params }: { method: string; params?: any[] }): Promise<any> {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [this.walletAddress];

      case 'eth_chainId':
        return `0x${this.chainId.toString(16)}`;

      case 'net_version':
        return this.chainId.toString();

      case 'eth_sendTransaction': {
        const [txParams] = params as [any];

        /**
         * CRITICAL SECTION: Vincent EVM Transaction Signing
         *
         * This is the CORRECT way to sign transactions:
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
          nonce: txParams.nonce,
          chainId: this.chainId,
        });

        // Get raw unsigned transaction bytes
        const unsignedSerialized = unsignedTx.unsignedSerialized;

        // Step 2: Call Vincent EVM transaction signer ability
        // This signs using the user's PKP wallet (NOT app wallet)
        const signResult = await this.evmSignerClient.execute(
          {
            chainId: this.chainId,
            rpcUrl: this.rpcUrl,
            signer: this.walletAddress, // User's PKP wallet address
            rawTransaction: unsignedSerialized, // Unsigned tx bytes
          },
          {
            // CRITICAL: This tells Vincent to sign using the delegated PKP
            // that the user authorized via JWT
            delegatorPkpEthAddress: this.walletAddress,
          }
        );

        if (!signResult.success) {
          throw new Error(
            signResult.result?.error || 'Transaction signing failed via Vincent PKP'
          );
        }

        // Step 3: Broadcast signed transaction
        const publicClient = createPublicClient({
          transport: http(this.rpcUrl),
          chain: this.chain,
        });

        const txHash = await publicClient.sendRawTransaction({
          serializedTransaction: signResult.result.signedTransaction as `0x${string}`,
        });

        return txHash;
      }

      case 'eth_getBalance':
      case 'eth_getTransactionCount':
      case 'eth_call':
      case 'eth_estimateGas':
      case 'eth_getCode':
      case 'eth_getStorageAt':
      case 'eth_blockNumber':
      case 'eth_getTransactionByHash':
      case 'eth_getTransactionReceipt': {
        // Read-only methods - proxy to RPC
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
  }

  removeListener(event: string, listener: (...args: any[]) => void): void {
    // No-op
  }
}

/**
 * Factory function to create Vincent-backed provider for Nexus SDK
 *
 * @param walletAddress - User's PKP wallet address from JWT
 * @param chainId - Source chain for transactions
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

**Key Changes:**
1. Import `@lit-protocol/vincent-ability-evm-transaction-signer`
2. Initialize `evmSignerClient` in constructor
3. In `eth_sendTransaction`:
   - Serialize unsigned transaction using Viem
   - Call `evmSignerClient.execute()` with `delegatorPkpEthAddress`
   - Broadcast the signed transaction returned by Vincent
4. App's private key ONLY used for authenticating with Vincent SDK, NOT for signing user transactions

**Reference Documentation:**
- Vincent EVM Transaction Signer Ability: https://github.com/LIT-Protocol/vincent-abilities/tree/main/packages/evm-transaction-signer
- Delegatee Pattern: Vincent SDK docs on JWT-based authorization

---

## 2. CRITICAL FIX: Remove Manual Approval Handling

### Problem Identified

**Original (WRONG) Implementation:**
```typescript
// ❌ Manually determines spender and calls approval ability
async executePurchase() {
  // Step 1: Swap PyUSD → USDC
  const swapResult = await this.walletService.swapPyusdToUsdc(...);

  // Step 2: Manual approval (WRONG - not needed)
  await this.walletService.approveToken({
    tokenAddress: USDC_ADDRESS,
    spenderAddress: NEXUS_ROUTER_ADDRESS, // We don't even know this!
    amount: usdcAmount,
  });

  // Step 3: Execute transfer
  await this.nexusService.executeTransfer(...);
}
```

**Why This is Wrong:**
- Nexus handles approvals internally via hooks
- We don't know the correct spender address (Nexus router is internal)
- Nexus SDK provides `setOnAllowanceHook` for this exact purpose
- Manual approval adds unnecessary complexity and potential errors

### Corrected Implementation

**File: `src/lib/nexus/service.ts`**

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
 * Why this works:
 * - Nexus knows which spender addresses need approval
 * - Nexus calculates exact amounts needed
 * - SDK surfaces these via setOnAllowanceHook
 * - We just call allow(['min']) and Nexus handles the rest
 *
 * Reference: Nexus Core API docs
 * https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference
 */
export class NexusService {
  private sdk: NexusSDK;
  private initialized = false;

  constructor(network: 'mainnet' | 'testnet' = 'testnet') {
    this.sdk = new NexusSDK({ network });
  }

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
    // Hook 1: Auto-approve cross-chain intents
    // Agent autonomously approves all intents
    this.sdk.setOnIntentHook(({ intent, allow, deny, refresh }) => {
      logger.info({ intent }, 'Intent hook triggered - auto-approving');

      // Agent policy: Auto-approve all intents
      // In production, you might want policy checks here
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
     *
     * Reference: Nexus Core API - setOnAllowanceHook
     * https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference#setonallowancehook
     */
    this.sdk.setOnAllowanceHook(({ sources, allow, deny }) => {
      logger.info(
        {
          sources: sources.map(s => ({
            token: s.token,
            chain: s.chainId,
            amountNeeded: s.amount,
          }))
        },
        'Allowance hook triggered - auto-approving min amounts'
      );

      // Agent policy: Auto-approve minimum required allowances
      // Nexus handles spender addresses and exact amounts
      allow(['min']);
    });
  }

  /**
   * Setup event listeners for transaction tracking
   */
  private setupEventListeners(): void {
    // Listen for transaction step completions
    this.sdk.nexusEvents.on(NEXUS_EVENTS.STEP_COMPLETE, async (step) => {
      logger.info({ step: step.data }, 'Nexus step completed');

      // Update transaction status in database
      if (step.data.transactionHash) {
        await prisma.transaction.updateMany({
          where: { hash: step.data.transactionHash },
          data: {
            status: step.data.error ? 'FAILED' : 'CONFIRMED',
            confirmedAt: new Date(),
            errorMessage: step.data.error || null,
          },
        });
      }
    });

    // Listen for route selections
    this.sdk.nexusEvents.on(NEXUS_EVENTS.ROUTE_SELECTED, (route) => {
      logger.info({ route: route.data }, 'Nexus route selected');
    });

    // Listen for errors
    this.sdk.nexusEvents.on(NEXUS_EVENTS.ERROR, (error) => {
      logger.error({ error: error.data }, 'Nexus error occurred');
    });
  }

  /**
   * Execute cross-chain USDC transfer
   *
   * NO manual approval needed - handled by allowance hook!
   *
   * @param params - Transfer parameters
   * @returns Transaction hash of the initial transaction
   */
  async executeTransfer(params: {
    fromChainId: number;
    toChainId: number;
    amount: number; // Human-readable (100 = 100 USDC)
    recipient: string;
  }): Promise<string> {
    if (!this.initialized) {
      throw new Error('Nexus SDK not initialized - call initialize() first');
    }

    logger.info({ params }, 'Executing cross-chain USDC transfer');

    // Execute transfer
    // Nexus will:
    // 1. Call allowance hook if approval needed
    // 2. Execute approval transaction via provider
    // 3. Execute transfer transaction
    // 4. Handle bridging/routing internally
    const result = await this.sdk.transfer({
      token: 'USDC',
      amount: params.amount,
      chainId: params.toChainId,
      recipient: params.recipient,
      sourceChains: [params.fromChainId],
    });

    if (!result.success) {
      logger.error({ result }, 'Nexus transfer failed');
      throw new Error(result.error || 'Cross-chain transfer failed');
    }

    logger.info(
      { txHash: result.transactionHash },
      'Cross-chain transfer initiated successfully'
    );

    return result.transactionHash!;
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

**Key Changes:**
1. Added `setupHooks()` method with clear documentation
2. `setOnAllowanceHook` auto-approves with `allow(['min'])`
3. Removed all manual approval code
4. Added detailed comments explaining why this works
5. Let Nexus handle spender addresses and amounts internally

**Reference Documentation:**
- Nexus Core API - setOnAllowanceHook: https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference#setonallowancehook
- Nexus Events: https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference#events

---

## 3. JWT Field Verification Strategy

### Problem Identified

The technical specification assumed `decodedJWT.sub` contains the PKP wallet address, but this needs verification.

### Implementation Strategy

**File: `src/lib/vincent/jwt.service.ts`** (NEW)

```typescript
import { verify, type DecodedJWT } from '@lit-protocol/vincent-app-sdk/jwt';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;

/**
 * JWT Verification Service
 *
 * TODO: VERIFY CORRECT FIELD FOR PKP ADDRESS
 *
 * According to Vincent docs, JWT contains user's PKP wallet address.
 * Need to verify if it's in:
 * - decodedJWT.sub (standard JWT subject claim)
 * - decodedJWT.pkpEthAddress (custom claim)
 *
 * Action items:
 * 1. Inspect actual JWT from Vincent after user authorization
 * 2. Check Vincent SDK types for DecodedJWT interface
 * 3. Consult Vincent documentation or team
 * 4. Update this function once confirmed
 */

/**
 * Extract PKP wallet address from Vincent JWT
 *
 * @param jwt - Raw JWT string from Vincent authorization
 * @returns PKP wallet address (checksummed)
 * @throws Error if address field not found or invalid
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

  // Strategy 3: Check other potential fields
  if ('walletAddress' in decodedJWT) {
    const walletAddress = (decodedJWT as any).walletAddress;
    if (walletAddress && typeof walletAddress === 'string' && walletAddress.startsWith('0x')) {
      logger.info('Found PKP address in decodedJWT.walletAddress');
      return walletAddress.toLowerCase();
    }
  }

  // If none found, log full JWT structure for debugging
  logger.error(
    {
      jwtFields: Object.keys(decodedJWT),
      subValue: decodedJWT.sub,
    },
    'Could not extract PKP address from JWT - unexpected structure'
  );

  throw new Error(
    'PKP wallet address not found in JWT. ' +
    'Please verify Vincent JWT structure and update extractPkpAddress()'
  );
}

/**
 * Verify JWT and extract PKP address
 *
 * @param jwtString - Raw JWT string from Vincent
 * @param audience - Expected JWT audience (app URL)
 * @returns Object with decoded JWT and PKP address
 * @throws Error if JWT invalid or PKP address not found
 */
export function verifyVincentJWT(jwtString: string, audience: string): {
  decodedJWT: DecodedJWT;
  pkpAddress: string;
} {
  // Verify JWT signature and audience
  const decodedJWT = verify(jwtString, audience);

  // Extract PKP address (will throw if not found)
  const pkpAddress = extractPkpAddress(decodedJWT);

  return { decodedJWT, pkpAddress };
}
```

**File: `src/app/api/vincent/auth/verify/route.ts`** (UPDATED)

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
      return NextResponse.json(
        { error: 'JWT required' },
        { status: 400 }
      );
    }

    const jwtAudience = process.env.NEXT_PUBLIC_APP_URL;
    if (!jwtAudience) {
      throw new Error('NEXT_PUBLIC_APP_URL not configured');
    }

    // Verify JWT and extract PKP address
    // This will throw if:
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

**Verification Action Items:**

1. **Manual JWT Inspection:**
   ```typescript
   // Add temporary debug endpoint
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

2. **Check Vincent SDK Types:**
   ```bash
   # Inspect DecodedJWT interface
   cd node_modules/@lit-protocol/vincent-app-sdk
   cat dist/jwt.d.ts | grep -A 20 "interface DecodedJWT"
   ```

3. **Test with Real JWT:**
   - Run frontend authentication flow
   - Get actual JWT after redirect
   - Inspect structure in debug endpoint
   - Update `extractPkpAddress()` accordingly

4. **Fallback Strategy:**
   If JWT structure is unclear, implement defensive extraction:
   ```typescript
   // Try all possible fields
   const possibleFields = ['sub', 'pkpEthAddress', 'walletAddress', 'address', 'pkp'];
   for (const field of possibleFields) {
     const value = decodedJWT[field];
     if (value && typeof value === 'string' && value.startsWith('0x')) {
       return value.toLowerCase();
     }
   }
   ```

---

## 4. Updated Purchase Flow

**File: `src/lib/agents/agent.service.ts`** (REVISED)

```typescript
import { VincentWalletService } from '@/lib/vincent/wallet.service';
import { NexusService } from '@/lib/nexus/service';
import { getPrismaClient } from '@/lib/database/prisma.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.agents;
const prisma = getPrismaClient();

export class AgentService {
  private walletService = new VincentWalletService();
  private nexusService = new NexusService('testnet');

  /**
   * Execute complete purchase flow
   *
   * Flow (3 steps, NO manual approval):
   * 1. Swap PyUSD → USDC (Vincent Uniswap swap ability)
   * 2. Initialize Nexus SDK (with Vincent-backed provider)
   * 3. Execute cross-chain transfer (Nexus handles approvals via hooks)
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

      // ========================================
      // STEP 1: Swap PyUSD → USDC
      // ========================================
      logger.info({ pyusdAmount }, 'Step 1: Swapping PyUSD to USDC');

      const swapResult = await this.walletService.swapPyusdToUsdc(buyerAgentId, {
        chainId: fromChainId,
        amountIn: pyusdAmount,
        slippageTolerance: 0.5, // 0.5% slippage
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
      logger.info('Step 2: Initializing Nexus SDK');

      await this.nexusService.initialize({
        walletAddress: buyerWalletAddress,
        sourceChainId: fromChainId,
      });

      logger.info('Step 2 complete: Nexus SDK initialized with Vincent provider');

      // ========================================
      // STEP 3: Execute Cross-Chain Transfer
      // ========================================
      // NOTE: NO manual approval here!
      // Nexus will:
      // 1. Detect USDC approval needed
      // 2. Call our allowance hook
      // 3. We call allow(['min'])
      // 4. Nexus executes approval tx via Vincent provider
      // 5. Nexus executes transfer tx
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

      throw error;
    }
  }
}
```

**Key Changes:**
1. Removed Step 2.5 (manual approval)
2. Updated comments to clarify Nexus handles approvals
3. Simplified to 3-step flow: Swap → Initialize → Transfer

---

## 5. Summary of Revisions

### Fixed Issues

| Issue | Original Problem | Solution |
|-------|------------------|----------|
| **Provider Signing** | Signed with app's private key, broadcasted from app wallet | Use Vincent EVM transaction signer ability to sign with user's PKP |
| **Manual Approval** | Manually determined spender and called approval ability | Removed manual approval, use Nexus `setOnAllowanceHook` with `allow(['min'])` |
| **JWT Field** | Assumed `sub` field without verification | Created defensive extraction function with multiple fallback strategies |

### Implementation Checklist

- [ ] Update `src/lib/vincent/provider.ts` with corrected signing logic
- [ ] Update `src/lib/nexus/service.ts` with allowance hook implementation
- [ ] Add `src/lib/vincent/jwt.service.ts` for JWT verification
- [ ] Update `src/app/api/vincent/auth/verify/route.ts` with defensive extraction
- [ ] Update `src/lib/agents/agent.service.ts` to remove manual approval step
- [ ] Test JWT field extraction with real Vincent authorization
- [ ] Verify provider signs transactions from user's PKP wallet address
- [ ] Verify Nexus automatically handles approvals via hooks
- [ ] Update tests to reflect corrected implementation
- [ ] Update documentation with corrected patterns

### Next Steps

1. **Immediate:** Verify JWT structure
   - Add debug endpoint
   - Run authentication flow
   - Inspect actual JWT fields
   - Update `extractPkpAddress()` function

2. **Implementation:** Apply all corrections
   - Update files with corrected code
   - Remove manual approval logic
   - Add comprehensive error handling

3. **Testing:** Verify corrections work
   - Unit tests for provider signing
   - Integration tests for purchase flow
   - Test that transactions come from PKP wallet
   - Test that approvals happen automatically

4. **Documentation:** Update technical spec
   - Revise provider section
   - Revise approval handling section
   - Add JWT verification section
   - Update architecture diagrams

---

## 6. Reference Documentation

### Vincent SDK
- **EVM Transaction Signer Ability:** https://github.com/LIT-Protocol/vincent-abilities/tree/main/packages/evm-transaction-signer
- **JWT Verification:** https://github.com/LIT-Protocol/vincent-app-sdk/blob/main/packages/jwt/README.md
- **Delegatee Pattern:** Vincent SDK docs on authorization

### Nexus SDK
- **Core API Reference:** https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference
- **Allowance Hook:** https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference#setonallowancehook
- **Events:** https://docs.availproject.org/nexus/avail-nexus-sdk/nexus-core/api-reference#events

### EIP-1193
- **Provider Standard:** https://eips.ethereum.org/EIPS/eip-1193
- **Viem Implementation:** https://viem.sh/docs/clients/wallet.html

---

## Conclusion

This revision addresses all three critical issues identified in the feedback:

1. **Provider Signing:** Now correctly uses Vincent EVM transaction signer ability instead of directly signing with app's private key
2. **Approval Handling:** Removed manual approval step, leveraging Nexus SDK's allowance hook system
3. **JWT Verification:** Added defensive extraction strategy with fallback fields

The corrected implementation follows the proper architectural patterns:
- User authorizes app via JWT
- App acts as delegatee using Vincent abilities
- Transactions sign and broadcast from user's PKP wallet
- Nexus handles approvals automatically via hooks
- All operations auditable and policy-compliant

Ready for senior engineer review and implementation.
