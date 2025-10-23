/**
 * Vincent OAuth Callback Page
 *
 * Handles the redirect from Vincent after user authorization
 * - Extracts JWT from URL
 * - Verifies with backend
 * - Redirects back to original page
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getWebAuthClient } from '@lit-protocol/vincent-app-sdk/webAuthClient';
import { loggers } from '@/lib/utils/logger';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';

const logger = loggers.vincent;
const VINCENT_JWT_KEY = 'VINCENT_AUTH_JWT';
const VINCENT_RETURN_URL_KEY = 'VINCENT_RETURN_URL';
const VINCENT_AGENT_ID_KEY = 'VINCENT_AGENT_ID';

export default function VincentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        setStatus('processing');

        // Initialize Vincent client
        const appIdStr = process.env.NEXT_PUBLIC_VINCENT_APP_ID;
        if (!appIdStr) {
          throw new Error('NEXT_PUBLIC_VINCENT_APP_ID not configured');
        }

        // Convert to number - Vincent SDK expects numeric appId
        const appId = Number(appIdStr);
        logger.info({ appId, appIdType: typeof appId }, 'Initializing Vincent client');

        const vincentAppClient = getWebAuthClient({ appId });

        // Check if URL contains JWT
        if (!vincentAppClient.uriContainsVincentJWT()) {
          throw new Error('No JWT found in callback URL');
        }

        logger.info('Processing Vincent callback with JWT');

        // First, let's decode the JWT without validation to see what audience Vincent set
        const urlParams = new URLSearchParams(window.location.search);
        const encodedJwt = urlParams.get('jwt');

        if (encodedJwt) {
          // Decode JWT payload (without verification) to inspect audience
          const parts = encodedJwt.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            logger.info({
              actualAudience: payload.aud,
              windowOrigin: window.location.origin,
              configuredAppUrl: process.env.NEXT_PUBLIC_APP_URL,
            }, 'JWT payload inspection');
          }
        }

        // Decode JWT from URL
        // Use full callback URI for audience validation (must match the exact URI in JWT aud claim)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const expectedAudience = `${appUrl}/vincent/callback`;
        logger.info({ expectedAudience }, 'Decoding JWT with expected audience');

        const { jwtStr } = await vincentAppClient.decodeVincentJWTFromUri(expectedAudience);

        if (!jwtStr) {
          throw new Error('Failed to decode JWT from URL');
        }

        // Store JWT in localStorage
        localStorage.setItem(VINCENT_JWT_KEY, jwtStr);
        logger.info('JWT stored in localStorage');

        // Get agent ID (if any) from localStorage
        const agentId = localStorage.getItem(VINCENT_AGENT_ID_KEY);

        // Verify JWT with backend
        const response = await fetch('/api/vincent/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jwt: jwtStr, agentId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'JWT verification failed');
        }

        const data = await response.json();
        logger.info({ walletAddress: data.walletAddress }, 'JWT verified successfully');

        // Get return URL from localStorage
        const returnUrl = localStorage.getItem(VINCENT_RETURN_URL_KEY) || '/';

        // Clean up
        localStorage.removeItem(VINCENT_RETURN_URL_KEY);
        localStorage.removeItem(VINCENT_AGENT_ID_KEY);

        setStatus('success');

        // Redirect back to original page after short delay
        setTimeout(() => {
          router.push(returnUrl);
        }, 500);

      } catch (err) {
        logger.error({ err }, 'Vincent callback error');
        const error = err instanceof Error ? err : new Error('Authentication failed');
        setErrorMessage(error.message);
        setStatus('error');

        // Clear stored JWT on error
        localStorage.removeItem(VINCENT_JWT_KEY);
      }
    }

    handleCallback();
  }, [router, searchParams]);

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <h1 className="text-xl font-semibold text-gray-900 mt-4">
              Completing Authentication
            </h1>
            <p className="text-gray-600 mt-2">
              Verifying your Vincent wallet connection...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mt-4">
              Authentication Successful
            </h1>
            <p className="text-gray-600 mt-2">
              Redirecting you back...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mt-4">
              Authentication Failed
            </h1>
            <p className="text-red-600 mt-2 text-sm">
              {errorMessage || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
