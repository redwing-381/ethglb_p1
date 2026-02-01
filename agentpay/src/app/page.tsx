'use client';

import { useState } from 'react';
import { WalletConnect } from '@/components/wallet-connect';
import { SessionManager } from '@/components/session-manager';
import { TaskInput } from '@/components/task-input';
import { ActivityFeed } from '@/components/activity-feed';
import { ResultsPanel } from '@/components/results-panel';
import { useYellowSession } from '@/hooks/use-yellow-session';
import { useAccount } from 'wagmi';
import type { ActivityEvent } from '@/types';

interface TaskResult {
  content: string;
  totalCost: string;
  agentsUsed: string[];
  subTaskCount: number;
}

export default function Home() {
  const { isConnected } = useAccount();
  const {
    session,
    isLoading,
    error,
    createSession,
    closeSession,
    activityEvents,
    addActivityEvent,
    recordPayment,
  } = useYellowSession();

  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const handleTaskSubmit = async (task: string) => {
    if (!session.channelId) return;
    
    setIsProcessing(true);
    setTaskError(null);
    setTaskResult(null);

    // Add task start event
    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'task_start',
      timestamp: Date.now(),
      data: { taskId: session.channelId || 'task', description: task },
    });

    try {
      const response = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          channelId: session.channelId,
          currentBalance: parseFloat(session.balance),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Task processing failed');
      }

      // Add payment events to activity feed
      if (data.events) {
        data.events.forEach((event: ActivityEvent) => {
          addActivityEvent(event);
        });
      }

      // Record payments to update balance
      if (data.payments) {
        data.payments.forEach((payment: { amount: string }) => {
          recordPayment(parseFloat(payment.amount));
        });
      }

      // Add completion event
      addActivityEvent({
        id: `event-complete-${Date.now()}`,
        type: 'task_complete',
        timestamp: Date.now(),
        data: {
          taskId: session.channelId || 'task',
          totalCost: data.result.totalCost,
          agentsUsed: data.result.agentsUsed,
        },
      });

      setTaskResult(data.result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTaskError(errorMessage);
      addActivityEvent({
        id: `event-error-${Date.now()}`,
        type: 'error',
        timestamp: Date.now(),
        data: { message: errorMessage },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">AgentPay</h1>
          <WalletConnect />
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Welcome to AgentPay
            </h2>
            <p className="text-gray-600 mb-8">
              AI agents paying each other instantly via Yellow Network
            </p>
            <p className="text-gray-500">
              Connect your wallet to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Session Manager */}
            <div className="lg:col-span-1">
              <SessionManager
                session={session}
                isLoading={isLoading}
                error={error}
                onCreateSession={createSession}
                onCloseSession={closeSession}
              />
            </div>

            {/* Right column - Task & Activity */}
            <div className="lg:col-span-2 space-y-6">
              {/* Task Input */}
              <TaskInput
                isSessionActive={session.status === 'active' && !isProcessing}
                onSubmit={handleTaskSubmit}
              />

              {/* Results Panel */}
              <ResultsPanel
                result={taskResult}
                isLoading={isProcessing}
                error={taskError}
              />

              {/* Activity Feed */}
              <ActivityFeed events={activityEvents} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
