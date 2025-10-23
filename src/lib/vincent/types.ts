/**
 * Vincent Wallet Types
 * Type definitions for Lit Protocol Vincent integration
 */

/**
 * Agent wallet policy defining spending limits and operational constraints
 */
export interface AgentWalletPolicy {
  /** Maximum transaction value in wei */
  maxTransactionValue: string;

  /** Daily spending limit in wei */
  dailySpendingLimit: string;

  /** Approved contract addresses that can be interacted with */
  approvedContractAddresses: string[];

  /** Maximum gas price in wei to prevent drain attacks */
  maxGasPrice: string;

  /** Allowed token symbols (e.g., ["PYUSD", "ETH"]) */
  allowedTokens: string[];

  /** Optional: Operational hours in UTC */
  operationalHours?: {
    start: number; // Hour 0-23
    end: number;   // Hour 0-23
  };

  /** Optional: High-value threshold requiring additional approval */
  highValueThreshold?: string;

  /** Optional: Required signers for high-value transactions */
  requiredSigners?: string[];
}

/**
 * Vincent wallet instance
 */
export interface VincentWallet {
  /** Lit Protocol PKP ID */
  pkpId: string;

  /** Ethereum address derived from PKP */
  address: string;

  /** Active wallet policies */
  policies: AgentWalletPolicy;

  /** Public key of the PKP */
  publicKey?: string;
}

/**
 * Request for signing EIP-712 typed data
 */
export interface SignTypedDataRequest {
  /** Agent ID requesting the signature */
  agentId: string;

  /** EIP-712 domain */
  domain: {
    name: string;
    version: string;
    chainId?: number;
    verifyingContract?: string;
  };

  /** EIP-712 types definition */
  types: Record<string, Array<{ name: string; type: string }>>;

  /** Values to sign */
  value: Record<string, any>;
}

/**
 * Lit Protocol session with cached authentication
 */
export interface LitSession {
  /** Cached authentication signature */
  authSig?: any;

  /** Session expiration timestamp */
  expiration: number;

  /** PKP public key associated with this session */
  pkpPublicKey?: string;
}

/**
 * Response from wallet creation
 */
export interface CreateWalletResponse {
  wallet: VincentWallet;
  success: boolean;
  error?: string;
}

/**
 * Signature response
 */
export interface SignatureResponse {
  signature: string;
  success: boolean;
  error?: string;
}

/**
 * Vincent service configuration
 */
export interface VincentConfig {
  /** Lit network to use (datil-dev, datil-test, datil) */
  network: string;

  /** Debug mode */
  debug?: boolean;

  /** Session timeout in milliseconds */
  sessionTimeout?: number;
}

/**
 * Default wallet policy constants
 */
export const DEFAULT_POLICY: AgentWalletPolicy = {
  maxTransactionValue: '100000000000000000000', // 100 ETH in wei
  dailySpendingLimit: '500000000000000000000', // 500 ETH in wei
  approvedContractAddresses: [], // Will be populated after contract deployment
  maxGasPrice: '50000000000', // 50 gwei
  allowedTokens: ['PYUSD', 'ETH'],
};

/**
 * Session expiration time (24 hours)
 */
export const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Maximum retry attempts for Lit connection
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Initial retry delay in milliseconds
 */
export const INITIAL_RETRY_DELAY_MS = 1000;
