/**
 * Global Error Handler
 *
 * Catches errors in the application and displays user-friendly error UI
 * Implements error recovery and logging
 */

'use client';

import { useEffect } from 'react';
import { Button } from './components/Button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console (in production, send to error tracking service)
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Error Icon */}
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Something Went Wrong
          </h1>
          <p className="text-gray-600 mb-6">
            We encountered an unexpected error. Don&apos;t worry, your data is safe.
          </p>

          {/* Error Details (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg text-left">
              <p className="text-xs font-semibold text-red-800 mb-2">
                Error Details (Development Only):
              </p>
              <p className="text-xs font-mono text-red-700 break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-red-600 mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={reset}
              variant="primary"
              size="lg"
              fullWidth
            >
              Try Again
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
              size="lg"
              fullWidth
            >
              Go to Homepage
            </Button>
          </div>

          {/* Help Text */}
          <p className="mt-6 text-sm text-gray-500">
            If the problem persists, please{' '}
            <a
              href="https://github.com/anthropics/claude-code/issues"
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              report this issue
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
