'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { SessionState, SessionStatus, PaymentRecord, ActivityEvent } from '@/types';
import { 
  YellowClient, 
  getYellowClient, 
  formatUSDC, 
  ConnectionStatus,
  SessionStatus as YellowSessionStatus,
} from '@/lib/yellow';

interface UseYellowSessionReturn {
  // State
  session: SessionState;
  connectionStatus: ConnectionStatus;
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

// Map Yellow session status to our SessionStatus type
function mapSessionStatus(status: YellowSessionStatus): SessionStatus {
  switch (status) {
    case 'none': return 'disconnected';
    case 'creating': return 'creating';
    case 'active': return 'active';
    case 'closing': return 'closing';
    case 'closed': return 'closed';
    case 'error': return 'error';
    default: return 'disconnected';
  }
}

export function useYellowSession(): UseYellowSessionReturn {
  const [session, setSession] = useState<SessionState>(initialSessionState);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  
  const clientRef = useRef<YellowClient | null>(null);

  // Initialize client on mount
  useEffect(() => {
    const client = getYellowClient({
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
      onSessionStatusChange: (status) => {
        setSession(prev => ({ ...prev, status: mapSessionStatus(status) }));
      },
      onBalanceUpdate: (balance) => {
        setSession(prev => ({ ...prev, balance }));
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
      // For now, use simplified channel creation
      // Full implementation will include wallet signatures
      const result = await client.createChannel({
        amount: budgetAmount,
        signState: async () => '0x' as `0x${string}`,
        writeContract: async () => '0x' as `0x${string}`,
        waitForTransaction: async () => {},
      });
      
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
      // For now, use simplified channel closure
      // Full implementation will include wallet signatures
      const result = await client.closeChannel({
        fundsDestination: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Will be replaced with actual wallet address
        signState: async () => '0x' as `0x${string}`,
        writeContract: async () => '0x' as `0x${string}`,
        waitForTransaction: async () => {},
      });
      
      // Add activity event
      addActivityEvent({
        id: `evt_${Date.now()}`,
        type: 'task_complete',
        timestamp: Date.now(),
        data: {
          taskId: session.channelId || '',
          totalCost: formatUSDC(
            BigInt(Math.floor(session.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0) * 1000000))
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
    connectionStatus,
    isConnected: connectionStatus === 'connected' || connectionStatus === 'authenticated',
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
