'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useYellowSession } from '@/hooks/use-yellow-session';
import { useToast } from '@/hooks/use-toast';
import { getNitroliteClient, getPlatformAddress, PLATFORM_CONFIG } from '@/lib/yellow';
import { getAgentAddress, type DebateAgentType } from '@/lib/yellow';
import { DEBATE_AGENT_CONFIGS } from '@/lib/ai';
import { getErrorMessage } from '@/lib/utils';
import type { AgentEarningsMap } from '@/components/agent-earnings';
import type { DebateTranscript, DebateCostBreakdown, ActivityEvent, SessionState } from '@/types';
import type { ApprovalStatus, ChannelLifecycleStatus } from '@/hooks/use-yellow-session';
import type { Toast } from '@/hooks/use-toast';
import type { WalletFunctions, CloseChannelWalletFunctions } from '@/types/wallet';

export interface AppState {
  // Session
  session: SessionState;
  isLoading: boolean;
  error: string | null;
  approvalStatus: ApprovalStatus;
  lifecycleStatus: ChannelLifecycleStatus;
  createSession: (budget: string, walletFns: WalletFunctions) => Promise<void>;
  closeSession: (walletFns: CloseChannelWalletFunctions) => Promise<void>;
  activityEvents: ActivityEvent[];
  addActivityEvent: (event: ActivityEvent) => void;
  recordPayment: (amount: number) => void;

  // Debate
  debateTopic: string | null;
  debateResult: DebateTranscript | null;
  costBreakdown: DebateCostBreakdown | null;
  isProcessing: boolean;
  debateError: string | null;
  agentEarnings: AgentEarningsMap;
  currentRound: number;
  activeAgent: DebateAgentType | null;
  handleDebateSubmit: (topic: string) => Promise<void>;

  // Toast
  toasts: Toast[];
  showToast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: string) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const {
    session, isLoading, error, approvalStatus, lifecycleStatus,
    createSession, closeSession, activityEvents, addActivityEvent, recordPayment,
  } = useYellowSession();

  const { toasts, showToast, dismissToast } = useToast();

  const [debateResult, setDebateResult] = useState<DebateTranscript | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<DebateCostBreakdown | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debateError, setDebateError] = useState<string | null>(null);
  const [agentEarnings, setAgentEarnings] = useState<AgentEarningsMap>({});
  const [currentRound, setCurrentRound] = useState(0);
  const [activeAgent, setActiveAgent] = useState<DebateAgentType | null>(null);
  const [debateTopic, setDebateTopic] = useState<string | null>(null);

  const handleDebateSubmit = useCallback(async (topic: string) => {
    if (!session.channelId) return;

    setIsProcessing(true);
    setDebateError(null);
    setDebateResult(null);
    setCostBreakdown(null);
    setCurrentRound(0);
    setActiveAgent('moderator');
    setDebateTopic(topic);

    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'task_start',
      timestamp: Date.now(),
      data: { taskId: session.channelId, description: `Debate: ${topic}` },
    });

    // Simulate progressive agent updates while API runs
    // The debate pipeline: moderator → (debater_a → debater_b → fact_checker → judge) × rounds → judge verdict → summarizer
    // With 3 rounds that's ~14 steps. We cycle through them on a timer so the UI feels alive.
    const agentSequence: { agent: DebateAgentType; round: number }[] = [
      { agent: 'moderator', round: 0 },
      { agent: 'debater_a', round: 1 }, { agent: 'debater_b', round: 1 },
      { agent: 'fact_checker', round: 1 }, { agent: 'judge', round: 1 },
      { agent: 'debater_a', round: 2 }, { agent: 'debater_b', round: 2 },
      { agent: 'fact_checker', round: 2 }, { agent: 'judge', round: 2 },
      { agent: 'debater_a', round: 3 }, { agent: 'debater_b', round: 3 },
      { agent: 'fact_checker', round: 3 }, { agent: 'judge', round: 3 },
      { agent: 'summarizer', round: 0 },
    ];
    let stepIdx = 0;
    const progressTimer = setInterval(() => {
      stepIdx++;
      if (stepIdx < agentSequence.length) {
        const { agent, round } = agentSequence[stepIdx];
        setActiveAgent(agent);
        if (round > 0) setCurrentRound(round);
      }
    }, 12000); // ~12s per step, total ~168s for 14 steps ≈ realistic AI timing

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

      // Stop simulated progress — real data is here
      clearInterval(progressTimer);

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Debate failed');

      // Now cycle through agents quickly during payment settlement
      // This shows the "payment" phase visually

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
                  icon: 'landmark',
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

      if (data.payments) {
        data.payments.forEach((p: { amount: string }) => recordPayment(parseFloat(p.amount)));
      }

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
      clearInterval(progressTimer);
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
  }, [session.channelId, session.balance, addActivityEvent, recordPayment, showToast]);

  const value: AppState = {
    session, isLoading, error, approvalStatus, lifecycleStatus,
    createSession, closeSession, activityEvents, addActivityEvent, recordPayment,
    debateResult, costBreakdown, isProcessing, debateError,
    debateTopic, agentEarnings, currentRound, activeAgent, handleDebateSubmit,
    toasts, showToast, dismissToast,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}
