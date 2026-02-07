'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, isReconnecting } = useAccount();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isReconnecting && !isConnected && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/');
    }
  }, [mounted, isConnected, isReconnecting, router]);

  // Show spinner only on initial mount or while reconnecting
  if (!mounted || isReconnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-6 w-6 border-2 border-border border-t-primary rounded-full" />
      </div>
    );
  }

  // If not connected, show nothing while redirect happens
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-6 w-6 border-2 border-border border-t-primary rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
