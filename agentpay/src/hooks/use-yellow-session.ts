'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { SessionState, SessionStatus, ActivityEvent } from '@/types';
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

// Generate a random channel ID for simulated mode
function generateChannelId(): `0x${string}` {
  const hex = Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return `0x${hex}` as `0x${string}`;
}

export function useYellowSession(): UseYellowSessionReturn {
  const [session, setSession] = useState<SessionState>(initialSessionState);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [useSimulatedMode, setUseSimulatedMode] = useState(false);
  
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
    
    // Try to connect to clearnode
    client.connect()
      .then(() => {
        console.log('✅ Connected to Yellow clearnode');
        setUseSimulatedMode(false);
      })
      .catch(err => {
        console.warn('⚠️ Failed to connect to Yellow clearnode, using simulated mode:', err);
        setUseSimulatedMode(true);
        // Set connected status for simulated mode
        setConnectionStatus('connected');
      });

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  const addActivityEvent = useCallback((event: ActivityEvent) => {
    setActivityEvents(prev => [event, ...prev]);
  }, []);

  const createSession = useCallback(async (budgetAmount: string) => {
    const client = clientRef.current;
    
    setIsLoading(true);
    setError(null);

    try {
      if (useSimulatedMode || !client?.isConnected()) {
        // Simulated mode - create a fake session
        console.log('📝 Creating simulated session with budget:', budgetAmount);
        
        const channelId = generateChannelId();
        
        setSession({
          channelId,
          balance: budgetAmount,
          status: 'active',
          payments: [],
          createdAt: Date.now(),
        });

        addActivityEvent({
          id: `evt_${Date.now()}`,
          type: 'task_start',
          timestamp: Date.now(),
          data: {
            taskId: channelId,
            description: `Session created with ${budgetAmount} USDC budget (simulated)`,
          },
        });
        
        return;
      }

      // Real Yellow integration would go here
      // For now, fall back to simulated mode
      console.log('📝 Yellow client connected but auth not implemented yet, using simulated mode');
      
      const channelId = generateChannelId();
      
      setSession({
        channelId,
        balance: budgetAmount,
        status: 'active',
        payments: [],
        createdAt: Date.now(),
      });

      addActivityEvent({
        id: `evt_${Date.now()}`,
        type: 'task_start',
        timestamp: Date.now(),
        data: {
          taskId: channelId,
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
  }, [useSimulatedMode, addActivityEvent]);

  const closeSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
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
  }, [session.channelId, session.payments, addActivityEvent]);

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

  const clearActivity = useCallback(() => {
    setActivityEvents([]);
  }, []);

  return {
    session,
    connectionStatus,
    isConnected: connectionStatus === 'connected' || connectionStatus === 'authenticated' || useSimulatedMode,
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
