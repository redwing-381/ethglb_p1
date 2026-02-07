'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { WalletConnect } from '@/components/wallet-connect';
import { HyperspaceBackground } from '@/components/ui/hyperspace-background';
import { BlurReveal } from '@/components/ui/blur-reveal';
import { Zap } from 'lucide-react';

export default function LandingPage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.replace('/dashboard');
    }
  }, [isConnected, router]);

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-black">
      <HyperspaceBackground
        starSpeed={1.02}
        starTrailOpacity={0.6}
        starColor="#8B5CF6"
        starSize={0.4}
        className="z-0"
      />
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl">
        <BlurReveal delay={0}>
          <div className="mb-6"><Zap className="w-12 h-12 text-primary" /></div>
        </BlurReveal>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
          <BlurReveal delay={0.1}>Agent</BlurReveal>
          <BlurReveal delay={0.2}>Pay</BlurReveal>
        </h1>
        <BlurReveal delay={0.4} className="text-lg text-white/70 mb-10 leading-relaxed max-w-lg">
          AI agents debate any topic and pay each other instantly — zero gas, powered by Yellow Network state channels.
        </BlurReveal>
        <BlurReveal delay={0.6}>
          <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 mb-8 w-full max-w-sm">
            <p className="text-sm text-white/60 mb-4">Connect your wallet to enter</p>
            <WalletConnect />
          </div>
        </BlurReveal>
        <BlurReveal delay={0.8}>
          <div className="flex items-center gap-6 text-xs text-white/40">
            <span>Yellow Network</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>ENS</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Sepolia Testnet</span>
          </div>
        </BlurReveal>
      </div>
    </main>
  );
}
