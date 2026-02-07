'use client';

import { AuthGuard } from '@/components/auth-guard';
import { AppStateProvider } from '@/contexts/app-state';
import { NavBar } from '@/components/nav-bar';
import { ToastContainer } from '@/components/toast';
import { Particles } from '@/components/ui/particles';
import { useAppState } from '@/contexts/app-state';

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { toasts, dismissToast } = useAppState();

  return (
    <div className="min-h-screen bg-background relative">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/3 rounded-full blur-[150px]" />
      </div>
      {/* Particles background */}
      <div className="fixed inset-0 pointer-events-none">
        <Particles
          variant="stars"
          style={{ count: 120, size: 1.2, opacity: 0.4, color: '#a78bfa' }}
          interactive={false}
        />
      </div>
      <div className="relative z-10">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppStateProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
      </AppStateProvider>
    </AuthGuard>
  );
}
