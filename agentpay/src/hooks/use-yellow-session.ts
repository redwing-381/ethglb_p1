'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { SessionState, SessionStatus, PaymentRecord, ActivityEvent } from '@/types';
import { YellowClient, getYellowClient, formatUSDC } from '@/lib/yellow';

interface UseYellowSessionReturn {
  // State
  session: SessionState;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createSession: (budgetAmount: string) => Promise<void>;
  closeSession: () => Promise<void>;
  recordPayment: (amount: number) => void;
  
  // Activity
  activityEvents: ActivityEvent[];
  addActivityEvent: (event: ActivityEvent) => void;
  clearActivity: () => void;
}

const initialSessionState: SessionState = {
  channelId: null,
  balance: '0',
  status: 'disconnected',
  payments: [],
  createdAt: null,
};

export function useYellowSession(): UseYellowSessionReturn {
  const [session, setSession] = useState<SessionState>(initialSessionState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  
  const clientRef = useRef<YellowClient | null>(null);

  // Initialize client on mount
  useEffect(() => {
    const client = getYellowClient({
      onStatusChange: (status) => {
        setSession(prev => ({ ...prev, status }));
      },
      onMessage: (message) => {
        console.log('Yellow message:', message);
      },
      onError: (err) => {
        setError(err.message);
      },
    });
    
    clientRef.current = client;
    
    // Connect to clearnode
    client.connect().catch(err => {
      console.error('Failed to connect to Yellow:', err);
      // Don't set error - we'll work in simulated mode
    });

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  const createSession = useCallback(async (budgetAmount: string) => {
    const client = clientRef.current;
    if (!client) {
      setError('Yellow client not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.createSession(budgetAmount);
      
      setSession({
        channelId: result.channelId,
        balance: result.balance,
        status: 'active',
        payments: [],
        createdAt: Date.now(),
      });

      // Add activity event
      addActivityEvent({
        id: `evt_${Date.now()}`,
        type: 'task_start',
        timestamp: Date.now(),
        data: {
          taskId: result.channelId,
          description: `Session created with ${budgetAmount} USDC budget`,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      setSession(prev => ({ ...prev, status: 'error' }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeSession = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      setError('Yellow client not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.closeSession();
      
      // Add activity event
      addActivityEvent({
        id: `evt_${Date.now()}`,
        type: 'task_complete',
        timestamp: Date.now(),
        data: {
          taskId: session.channelId || '',
          totalCost: formatUSDC(
            BigInt(session.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) * 1000000)
          ),
          agentsUsed: [...new Set(session.payments.map(p => p.to))],
        },
      });

      setSession({
        ...initialSessionState,
        status: 'closed',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close session';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [session.channelId, session.payments]);

  const recordPayment = useCallback((amount: number) => {
    // Update session balance
    setSession(prev => {
      const currentBalance = parseFloat(prev.balance);
      const newBalance = Math.max(0, currentBalance - amount);
      return {
        ...prev,
        balance: newBalance.toFixed(2),
      };
    });
  }, []);

  const addActivityEvent = useCallback((event: ActivityEvent) => {
    setActivityEvents(prev => [event, ...prev]);
  }, []);

  const clearActivity = useCallback(() => {
    setActivityEvents([]);
  }, []);

  return {
    session,
    isConnected: session.status === 'active',
    isLoading,
    error,
    createSession,
    closeSession,
    recordPayment,
    activityEvents,
    addActivityEvent,
    clearActivity,
  };
}
