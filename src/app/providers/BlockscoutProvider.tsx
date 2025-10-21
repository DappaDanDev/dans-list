'use client';

import { NotificationProvider } from '@blockscout/app-sdk';
import type { ReactNode } from 'react';

interface BlockscoutProviderProps {
  children: ReactNode;
}

/**
 * Blockscout Provider for transaction notifications and monitoring
 * Wraps the application with Blockscout SDK notification capabilities
 */
export function BlockscoutProvider({ children }: BlockscoutProviderProps) {
  return (
    <NotificationProvider>
      {children}
    </NotificationProvider>
  );
}

export default BlockscoutProvider;