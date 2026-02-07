'use client';

import { useCallback, useState } from 'react';
import {
  useAccount,
  useSignTypedData,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignMessage,
  useSwitchChain,
  useChainId,
  useWalletClient,
} from 'wagmi';
import { useAppState } from '@/contexts/app-state';
import { SessionManager } from '@/components/session-manager';
import { StatCard } from '@/components/stat-card';
import { PageTransition } from '@/components/page-transition';
import { BlurReveal } from '@/components/ui/blur-reveal';
import { GlowingButton } from '@/components/ui/glowing-button';
import { AnimatedCard, CardBody } from '@/components/ui/animated-card';
import { BorderBeam } from '@/components/ui/border-beam';
import Link from 'next/link';
import { Wallet, Zap, CircleDot, Swords, Shield, Radio, Bot } from 'lucide-react';

export default function DashboardPage() {
  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isWaitingForTx } = useWaitForTransactionReceipt({ hash: pendingTxHash });

  const {
    session, isLoading, error, approvalStatus, lifecycleStatus,
    createSession, closeSession, activityEvents,
  } = useAppState();

  const signTypedData = useCallback(async (params: {
    domain: { name: string };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => signTypedDataAsync({
    domain: params.domain, types: params.types,
    primaryType: params.primaryType, message: params.message,
  }), [signTypedDataAsync]);

  const writeContract = useCallback(async (params: {
    address: `0x${string}`; abi: readonly unknown[];
    functionName: string; args: unknown[]; value?: bigint; gas?: bigint;
  }) => {
    const config = {
      address: params.address, abi: params.abi,
      functionName: params.functionName, args: params.args,
    } as Parameters<typeof writeContractAsync>[0];
    if (params.value !== undefined) (config as Record<string, unknown>).value = params.value;
    if (params.gas !== undefined) (config as Record<string, unknown>).gas = params.gas;
    const hash = await writeContractAsync(config);
    setPendingTxHash(hash);
    return hash;
  }, [writeContractAsync]);

  const waitForTransaction = useCallback(async (hash: `0x${string}`) => {
    setPendingTxHash(hash);
    return new Promise<void>((resolve, reject) => {
      const check = async () => {
        let attempts = 0;
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 2000));
          attempts++;
          if (!isWaitingForTx) { resolve(); return; }
        }
        reject(new Error('Transaction confirmation timeout'));
      };
      check();
    });
  }, [isWaitingForTx]);

  const signMessage = useCallback(async (params: { message: `0x${string}` | string }) =>
    signMessageAsync({ message: params.message }), [signMessageAsync]);

  const switchChain = useCallback(async (targetChainId: number) => {
    await switchChainAsync({ chainId: targetChainId });
  }, [switchChainAsync]);

  const readContract = useCallback(async <T,>(params: {
    address: `0x${string}`; abi: readonly unknown[];
    functionName: string; args?: unknown[];
  }): Promise<T> => {
    const { readContract: viemReadContract } = await import('viem/actions');
    const { createPublicClient, http } = await import('viem');
    const { sepolia } = await import('viem/chains');
    const publicClient = createPublicClient({ chain: sepolia, transport: http() });
    return viemReadContract(publicClient, {
      address: params.address, abi: params.abi,
      functionName: params.functionName, args: params.args,
    }) as Promise<T>;
  }, []);

  const isActive = session.status === 'active';
  const paymentCount = activityEvents.filter(e => e.type === 'payment' || e.type === 'platform_fee').length;

  return (
    <PageTransition>
      <div className="mb-8">
        <BlurReveal delay={0} className="block">
          <h1 className="text-3xl font-bold text-foreground mb-1 flex items-center gap-3">
            Dashboard
            {isActive && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
            )}
          </h1>
        </BlurReveal>
        <BlurReveal delay={0.1} className="block">
          <p className="text-muted-foreground">Manage your session and fund AI agent debates</p>
        </BlurReveal>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <BlurReveal delay={0.1} className="block">
          <StatCard
            label="Balance"
            value={`${session.balance} USDC`}
            icon={<Wallet className="w-5 h-5" />}
            highlight={isActive}
          />
        </BlurReveal>
        <BlurReveal delay={0.15} className="block">
          <StatCard
            label="Payments"
            value={String(paymentCount)}
            icon={<Zap className="w-5 h-5" />}
          />
        </BlurReveal>
        <BlurReveal delay={0.2} className="block">
          <StatCard
            label="Status"
            value={session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            icon={<CircleDot className={`w-5 h-5 ${isActive ? 'text-green-500' : 'text-muted-foreground'}`} />}
          />
        </BlurReveal>
      </div>

      {/* Session Manager + Quick Actions side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <BlurReveal delay={0.25} className="block">
            <AnimatedCard>
              <SessionManager
                session={session} isLoading={isLoading} error={error}
                approvalStatus={approvalStatus} lifecycleStatus={lifecycleStatus}
                onCreateSession={createSession} onCloseSession={closeSession}
                walletAddress={walletAddress} isWalletConnected={isConnected}
                signTypedData={signTypedData} writeContract={writeContract}
                waitForTransaction={waitForTransaction} signMessage={signMessage}
                readContract={readContract} currentChainId={chainId}
                switchChain={switchChain} walletClient={walletClient}
              />
            </AnimatedCard>
          </BlurReveal>
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
          <Link href="/debate">
            <AnimatedCard className="group cursor-pointer hover:border-primary/30 transition-all duration-300 mb-3 relative overflow-hidden">
              <BorderBeam lightColor="#8B5CF6" lightWidth={150} duration={8} borderWidth={1} />
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Swords className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Start Debate</p>
                    <p className="text-xs text-muted-foreground">AI agents argue any topic</p>
                  </div>
                </div>
              </CardBody>
            </AnimatedCard>
          </Link>
          <Link href="/agents">
            <AnimatedCard className="group cursor-pointer hover:border-primary/30 transition-all duration-300 mb-3 relative overflow-hidden">
              <BorderBeam lightColor="#3B82F6" lightWidth={150} duration={10} borderWidth={1} />
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">View Agents</p>
                    <p className="text-xs text-muted-foreground">ENS-registered on Sepolia</p>
                  </div>
                </div>
              </CardBody>
            </AnimatedCard>
          </Link>
          <Link href="/activity">
            <AnimatedCard className="group cursor-pointer hover:border-primary/30 transition-all duration-300 relative overflow-hidden">
              <BorderBeam lightColor="#F59E0B" lightWidth={150} duration={12} borderWidth={1} />
              <CardBody className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Activity Feed</p>
                    <p className="text-xs text-muted-foreground">{paymentCount} payments tracked</p>
                  </div>
                </div>
              </CardBody>
            </AnimatedCard>
          </Link>
        </div>
      </div>

      {/* Tech stack footer */}
      <BlurReveal delay={0.35} className="block">
        <div className="flex items-center justify-center gap-3 py-6 mt-4 border-t border-border/40 text-xs text-muted-foreground/60">
          <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Yellow Network</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span>ENS Identity</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span>Sepolia Testnet</span>
        </div>
      </BlurReveal>
    </PageTransition>
  );
}
