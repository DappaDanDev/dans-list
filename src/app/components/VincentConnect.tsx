/**
 * VincentConnect Component
 *
 * Handles JWT-based authentication flow with Vincent
 *
 * Flow:
 * 1. User clicks "Connect Wallet"
 * 2. Stores current URL in localStorage
 * 3. Redirects to Vincent authorization page
 * 4. User approves in Vincent
 * 5. Vincent redirects to /vincent/callback with JWT
 * 6. Callback page extracts JWT, verifies with backend
 * 7. Callback page redirects back to original page
 * 8. Component detects stored JWT and completes auth
 *
 * Reference: Vincent WebAuthClient docs
 * https://github.com/LIT-Protocol/vincent-app-sdk/tree/main/packages/webAuthClient
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getWebAuthClient } from '@lit-protocol/vincent-app-sdk/webAuthClient';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;

/**
 * Local storage keys
 */
const VINCENT_JWT_KEY = 'VINCENT_AUTH_JWT';
const VINCENT_RETURN_URL_KEY = 'VINCENT_RETURN_URL';
const VINCENT_AGENT_ID_KEY = 'VINCENT_AGENT_ID';

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
    const appIdStr = process.env.NEXT_PUBLIC_VINCENT_APP_ID;
    if (!appIdStr) {
      throw new Error('NEXT_PUBLIC_VINCENT_APP_ID not configured');
    }

    // Convert to number - Vincent SDK expects numeric appId
    const appId = Number(appIdStr);

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
        // Check for existing JWT in localStorage
        // (JWT from callback route will already be stored)
        const storedJwt = localStorage.getItem(VINCENT_JWT_KEY);
        if (storedJwt) {
          try {
            // Manually check if JWT is expired (safer than Vincent SDK's isExpired)
            const parts = storedJwt.split('.');
            if (parts.length !== 3) {
              throw new Error('Invalid JWT format');
            }

            const payload = JSON.parse(atob(parts[1]));
            const now = Math.floor(Date.now() / 1000);
            const expired = payload.exp && payload.exp < now;

            if (!expired) {
              logger.info('Found valid JWT in localStorage');
              await verifyJwtWithBackend(storedJwt);
              return;
            } else {
              logger.info('Stored JWT expired, clearing');
              localStorage.removeItem(VINCENT_JWT_KEY);
            }
          } catch (jwtError) {
            // JWT is malformed or invalid, clear it
            logger.warn({ err: jwtError }, 'Invalid JWT in localStorage, clearing');
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
  }, [verifyJwtWithBackend, onAuthError]);

  /**
   * Initiate Vincent authorization flow
   * Redirects to Vincent authorization page
   */
  function handleConnect() {
    try {
      setIsConnecting(true);
      setError(null);

      // Get configured app URL (ensures consistency with Vincent config)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

      // Store current URL for return after auth
      localStorage.setItem(VINCENT_RETURN_URL_KEY, window.location.pathname);

      // Store agent ID if provided
      if (agentId) {
        localStorage.setItem(VINCENT_AGENT_ID_KEY, agentId);
      }

      logger.info('Redirecting to Vincent auth', {
        returnUrl: window.location.pathname,
        agentId,
        appUrl,
      });

      // Redirect to Vincent for authorization
      // Use dedicated callback route with configured app URL
      const callbackUri = `${appUrl}/vincent/callback`;

      vincentAppClient.redirectToConnectPage({
        redirectUri: callbackUri,
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
