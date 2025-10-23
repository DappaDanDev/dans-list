import { getVincentAbilityClient } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { bundledVincentAbility as erc20ApprovalAbility } from '@lit-protocol/vincent-ability-erc20-approval';
import { bundledVincentAbility as uniswapSwapAbility } from '@lit-protocol/vincent-ability-uniswap-swap';
import { bundledVincentAbility as evmTxSignerAbility } from '@lit-protocol/vincent-ability-evm-transaction-signer';
import { ethers } from 'ethers';
import { VINCENT_CONFIG } from './config';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;

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
  if (!VINCENT_CONFIG.appPrivateKey) {
    throw new Error('VINCENT_APP_PRIVATE_KEY not configured in environment');
  }
  return new ethers.Wallet(VINCENT_CONFIG.appPrivateKey);
}

/**
 * Get ERC-20 Approval Ability Client
 *
 * Used for token approvals (though Nexus handles this via hooks)
 */
export function getErc20ApprovalClient() {
  logger.debug('Creating ERC20 approval ability client');
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
  logger.debug('Creating Uniswap swap ability client');
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
  logger.debug('Creating EVM transaction signer ability client');
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
  serializedTransaction: string; // Unsigned tx hex (from ethers.utils.serializeTransaction)
}

/**
 * Result types from abilities
 */

export interface AbilityPrecheckResult<T = any> {
  success: boolean;
  result?: T;
}

export interface AbilityExecuteResult<T = any> {
  success: boolean;
  result?: T;
}

export interface UniswapSwapExecuteResult {
  amountOut: string; // Amount of tokens received
  swapTxHash: string; // Transaction hash of the swap
}

export interface EvmTxSignerExecuteResult {
  signedTransaction: string; // Hex string of signed transaction
  deserializedSignedTransaction: any; // Decoded transaction object
}
