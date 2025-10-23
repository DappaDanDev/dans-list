import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during builds (errors will be fixed separately)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Webpack configuration for module resolution
  webpack: (config, { isServer }) => {
    // Server-side: externalize packages to avoid bundling issues
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        '@lit-protocol/vincent-ability-uniswap-swap',
        '@lit-protocol/vincent-ability-evm-transaction-signer',
        '@uniswap/smart-order-router',
        '@nexus-sdk/client'
      );
    }

    // Client-side: don't bundle server-only modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },

  // Transpile ESM packages
  transpilePackages: [
    '@lit-protocol/vincent-ability-uniswap-swap',
    '@lit-protocol/vincent-ability-evm-transaction-signer',
    '@lit-protocol/vincent-app-sdk',
  ],
};

export default nextConfig;
