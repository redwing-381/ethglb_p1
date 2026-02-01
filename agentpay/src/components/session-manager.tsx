'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SessionState } from '@/types';

interface SessionManagerProps {
  session: SessionState;
  isLoading: boolean;
  error: string | null;
  onCreateSession: (budgetAmount: string) => Promise<void>;
  onCloseSession: () => Promise<void>;
}

export function SessionManager({
  session,
  isLoading,
  error,
  onCreateSession,
  onCloseSession,
}: SessionManagerProps) {
  const [budgetInput, setBudgetInput] = useState('5');

  const handleCreateSession = async () => {
    if (!budgetInput || parseFloat(budgetInput) <= 0) return;
    await onCreateSession(budgetInput);
  };

  const isActive = session.status === 'active';
  const hasSession = session.channelId !== null;

  // Calculate spent amount
  const totalSpent = session.payments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0
  );
  const initialBalance = hasSession && session.createdAt 
    ? parseFloat(session.balance) + totalSpent 
    : 0;
  const percentRemaining = initialBalance > 0 
    ? (parseFloat(session.balance) / initialBalance) * 100 
    : 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Agent Session</span>
          <StatusBadge status={session.status} />
        </CardTitle>
        <CardDescription>
          {isActive 
            ? 'Session active - agents can execute tasks'
            : 'Create a session to start using agents'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {!hasSession ? (
          // Create session form
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Session Budget (USDC)
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="5.00"
                  className="flex-1"
                />
                <Button 
                  onClick={handleCreateSession}
                  disabled={isLoading || !budgetInput}
                >
                  {isLoading ? 'Creating...' : 'Create Session'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                This amount will be available for agent payments
              </p>
            </div>
          </div>
        ) : (
          // Active session display
          <div className="space-y-4">
            {/* Balance display */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Session Balance</span>
                <span className="text-lg font-semibold">
                  {parseFloat(session.balance).toFixed(2)} USDC
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, percentRemaining))}%` }}
                />
              </div>
              
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Spent: {totalSpent.toFixed(2)} USDC</span>
                <span>{percentRemaining.toFixed(0)}% remaining</span>
              </div>
            </div>

            {/* Session info */}
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Channel ID:</span>
                <span className="font-mono">{truncateId(session.channelId || '')}</span>
              </div>
              <div className="flex justify-between">
                <span>Payments:</span>
                <span>{session.payments.length}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={onCloseSession}
                disabled={isLoading}
              >
                {isLoading ? 'Settling...' : 'Settle & Close'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    disconnected: 'bg-gray-100 text-gray-600',
    creating: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    closing: 'bg-yellow-100 text-yellow-700',
    closed: 'bg-gray-100 text-gray-600',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.disconnected}`}>
      {status}
    </span>
  );
}

function truncateId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}
