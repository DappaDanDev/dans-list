/**
 * VincentConnect Component
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

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getWebAuthClient } from '@lit-protocol/vincent-app-sdk/webAuthClient';
import { isExpired } from '@lit-protocol/vincent-app-sdk/jwt';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;

/**
 * Local storage key for JWT
 */
const VINCENT_JWT_KEY = 'VINCENT_AUTH_JWT';

/**
 * Component props
 */
interface VincentConnectProps {
  onAuthComplete: (jwt: string, walletAddress: string) => void;
  onAuthError?: (error: Error) => void;
  agentId?: string; // Optional: Associate auth with specific agent
}

/**
 * VincentConnect Component
 */
export function VincentConnect({ onAuthComplete, onAuthError, agentId }: VincentConnectProps) {
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

  /**
   * Verify JWT with backend
   * Backend validates signature and stores in DB
   */
  const verifyJwtWithBackend = useCallback(async (jwt: string): Promise<void> => {
    try {
      const response = await fetch('/api/vincent/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwt, agentId }),
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
  }, [agentId, onAuthComplete]);

  useEffect(() => {
    async function handleAuthFlow() {
      try {
        // Check if URL contains JWT after redirect
        if (vincentAppClient.uriContainsVincentJWT()) {
          logger.info('Detected JWT in URL after redirect');

          const redirectUri = window.location.origin;
          const { jwtStr } = vincentAppClient.decodeVincentJWTFromUri(redirectUri);

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
  }, [vincentAppClient, verifyJwtWithBackend, onAuthError]);

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
        <span className="text-gray-600">Checking authentication...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
