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
