'use client';

import { useState, useCallback } from 'react';
import { WalletConnect } from '@/components/wallet-connect';
import { SessionManager } from '@/components/session-manager';
import { DebateInput } from '@/components/debate-input';
import { DebateResults } from '@/components/debate-results';
import { DebateProgress } from '@/components/debate-progress';
import { ActivityFeed } from '@/components/activity-feed';
import { AgentCardsSection } from '@/components/agent-cards-section';
import { ToastContainer } from '@/components/toast';
import { useYellowSession } from '@/hooks/use-yellow-session';
import { useToast } from '@/hooks/use-toast';
import { getNitroliteClient, getPlatformAddress, PLATFORM_CONFIG } from '@/lib/yellow';
import { getAgentAddress, type DebateAgentType } from '@/lib/yellow';
import { DEBATE_AGENT_CONFIGS } from '@/lib/ai';
import { getErrorMessage } from '@/lib/utils';
import { AgentEarnings, type AgentEarningsMap } from '@/components/agent-earnings';
import type { DebateTranscript, DebateCostBreakdown } from '@/types';
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

export default function Home() {
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();

  const {
    session, isLoading, error, approvalStatus, lifecycleStatus,
    createSession, closeSession, activityEvents, addActivityEvent, recordPayment,
  } = useYellowSession();

  const { toasts, showToast, dismissToast } = useToast();

  const [debateResult, setDebateResult] = useState<DebateTranscript | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<DebateCostBreakdown | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debateError, setDebateError] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const [agentEarnings, setAgentEarnings] = useState<AgentEarningsMap>({});
  const [currentRound, setCurrentRound] = useState(0);
  const [activeAgent, setActiveAgent] = useState<DebateAgentType | null>(null);

  const { isLoading: isWaitingForTx } = useWaitForTransactionReceipt({ hash: pendingTxHash });

  // Wallet wrapper functions (same pattern as before)
  const signTypedData = useCallback(async (params: {
    domain: { name: string };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> => {
    return signTypedDataAsync({
      domain: params.domain, types: params.types,
      primaryType: params.primaryType, message: params.message,
    });
  }, [signTypedDataAsync]);

  const writeContract = useCallback(async (params: {
    address: `0x${string}`; abi: readonly unknown[];
    functionName: string; args: unknown[]; value?: bigint; gas?: bigint;
  }): Promise<`0x${string}`> => {
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

  const waitForTransaction = useCallback(async (hash: `0x${string}`): Promise<void> => {
    setPendingTxHash(hash);
    return new Promise((resolve, reject) => {
      const checkReceipt = async () => {
        const maxAttempts = 60;
        let attempts = 0;
        while (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 2000));
          attempts++;
          if (!isWaitingForTx) { resolve(); return; }
        }
        reject(new Error('Transaction confirmation timeout'));
      };
      checkReceipt();
    });
  }, [isWaitingForTx]);

  const signMessage = useCallback(async (params: { message: `0x${string}` | string }): Promise<`0x${string}`> => {
    return signMessageAsync({ message: params.message });
  }, [signMessageAsync]);

  const switchChain = useCallback(async (targetChainId: number): Promise<void> => {
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
    const result = await viemReadContract(publicClient, {
      address: params.address, abi: params.abi,
      functionName: params.functionName, args: params.args,
    });
    return result as T;
  }, []);

  // ========== Debate submission handler ==========
  const handleDebateSubmit = async (topic: string) => {
    if (!session.channelId) return;

    setIsProcessing(true);
    setDebateError(null);
    setDebateResult(null);
    setCostBreakdown(null);
    setCurrentRound(0);
    setActiveAgent('moderator');

    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'task_start',
      timestamp: Date.now(),
      data: { taskId: session.channelId, description: `Debate: ${topic}` },
    });

    try {
      const nitroliteClient = getNitroliteClient();

      const response = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          channelId: session.channelId,
          currentBalance: parseFloat(session.balance),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Debate failed');

      // Execute Yellow transfers
      if (data.payments?.length > 0 && nitroliteClient.isAuthenticated()) {
        const allAgentTypes: DebateAgentType[] = ['moderator', 'debater_a', 'debater_b', 'fact_checker', 'judge', 'summarizer'];

        for (const payment of data.payments) {
          const isPlatformFee = payment.to.toLowerCase() === getPlatformAddress().toLowerCase();

          if (isPlatformFee) {
            try {
              const result = await nitroliteClient.transfer(payment.to as `0x${string}`, payment.amount);
              setAgentEarnings(prev => ({
                ...prev,
                platform: {
                  name: 'AgentPay Platform', address: payment.to,
                  earned: ((prev.platform ? parseFloat(prev.platform.earned) : 0) + parseFloat(payment.amount)).toFixed(4),
                  icon: '🏦',
                },
              }));
              addActivityEvent({
                id: `event-platform-${result.transactionId}`,
                type: 'platform_fee',
                timestamp: Date.now(),
                data: {
                  from: 'You', to: 'AgentPay Platform', amount: payment.amount,
                  asset: 'USDC', feePercentage: PLATFORM_CONFIG.FEE_PERCENTAGE,
                  transactionId: result.transactionId, success: true,
                },
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              addActivityEvent({
                id: `event-platform-err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'error', timestamp: Date.now(),
                data: { message: `Platform fee failed: ${msg}`, code: 'TRANSFER_FAILED' },
              });
            }
            continue;
          }

          // Find which agent this payment is for
          const agentType = allAgentTypes.find(t =>
            getAgentAddress(t).toLowerCase() === payment.to.toLowerCase()
          );

          if (agentType) {
            const config = DEBATE_AGENT_CONFIGS[agentType];
            setActiveAgent(agentType);

            try {
              const result = await nitroliteClient.transfer(payment.to as `0x${string}`, payment.amount);
              setAgentEarnings(prev => ({
                ...prev,
                [agentType]: {
                  name: config.name, address: payment.to,
                  earned: ((prev[agentType] ? parseFloat(prev[agentType].earned) : 0) + parseFloat(payment.amount)).toFixed(4),
                  icon: config.icon,
                },
              }));
              addActivityEvent({
                id: `event-pay-${result.transactionId}`,
                type: 'payment', timestamp: Date.now(),
                data: {
                  from: 'You', to: config.name, amount: payment.amount,
                  asset: 'USDC', transactionId: result.transactionId, success: true,
                },
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              addActivityEvent({
                id: `event-pay-err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'error', timestamp: Date.now(),
                data: { message: `Payment to ${config.name} failed: ${msg}`, code: 'TRANSFER_FAILED' },
              });
              throw new Error(`Payment to ${config.name} failed: ${msg}`);
            }
          }
        }
      } else if (!nitroliteClient.isAuthenticated()) {
        throw new Error('Nitrolite client not authenticated. Please reconnect your session.');
      }

      // Record payments
      if (data.payments) {
        data.payments.forEach((p: { amount: string }) => recordPayment(parseFloat(p.amount)));
      }

      // Completion event
      addActivityEvent({
        id: `event-complete-${Date.now()}`,
        type: 'task_complete', timestamp: Date.now(),
        data: {
          taskId: session.channelId || 'debate',
          totalCost: data.costBreakdown?.totalCost || '0',
          agentsUsed: ['Moderator', 'Debater A', 'Debater B', 'Fact Checker', 'Judge', 'Summarizer'],
        },
      });

      setDebateResult(data.debate);
      setCostBreakdown(data.costBreakdown);
      showToast('success', 'Debate completed!');
    } catch (err) {
      const msg = getErrorMessage(err);
      setDebateError(msg);
      addActivityEvent({
        id: `event-err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'error', timestamp: Date.now(),
        data: { message: msg },
      });
      showToast('error', msg);
    } finally {
      setIsProcessing(false);
      setActiveAgent(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h1 className="text-lg font-semibold text-gray-900">AI Debate Arena</h1>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!isWalletConnected ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">AI Debate Arena</h2>
            <p className="text-gray-600 mb-8">
              Watch 6 AI agents debate any topic. They pay each other instantly using Yellow Network state channels.
            </p>
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <p className="text-sm text-gray-500 mb-4">Connect your wallet to get started</p>
              <WalletConnect />
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
              <span>Powered by Yellow Network</span>
              <span>•</span>
              <span>ENS</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <SessionManager
                session={session} isLoading={isLoading} error={error}
                approvalStatus={approvalStatus} lifecycleStatus={lifecycleStatus}
                onCreateSession={createSession} onCloseSession={closeSession}
                walletAddress={walletAddress} isWalletConnected={isWalletConnected}
                signTypedData={signTypedData} writeContract={writeContract}
                waitForTransaction={waitForTransaction} signMessage={signMessage}
                readContract={readContract} currentChainId={chainId}
                switchChain={switchChain} walletClient={walletClient}
              />
              <AgentCardsSection />
              {Object.keys(agentEarnings).length > 0 && (
                <AgentEarnings earnings={agentEarnings} />
              )}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <DebateInput
                isSessionActive={session.status === 'active' && !isProcessing}
                onSubmit={handleDebateSubmit}
              />
              <DebateProgress
                currentRound={currentRound}
                totalRounds={3}
                activeAgent={activeAgent}
                isActive={isProcessing}
              />
              <DebateResults
                debate={debateResult}
                costBreakdown={costBreakdown}
                isLoading={isProcessing}
                error={debateError}
              />
              <ActivityFeed events={activityEvents} />
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
