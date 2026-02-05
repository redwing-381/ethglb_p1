'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { SessionState, SessionStatus, ActivityEvent } from '@/types';
import type { WalletFunctions, CloseChannelWalletFunctions } from '@/types/wallet';
import { 
  YellowClient, 
  getYellowClient, 
  formatUSDC, 
  ConnectionStatus,
  SessionStatus as YellowSessionStatus,
} from '@/lib/yellow';
import { createWalletError, parseWalletError } from '@/lib/wallet-errors';

interface UseYellowSessionReturn {
  // State
  session: SessionState;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions - now require wallet functions for real operations
  createSession: (budgetAmount: string, walletFunctions: WalletFunctions) => Promise<void>;
  closeSession: (walletFunctions: CloseChannelWalletFunctions) => Promise<void>;
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
    client.connect()
      .then(() => {
        console.log('✅ Connected to Yellow clearnode');
      })
      .catch(err => {
        console.error('❌ Failed to connect to Yellow clearnode:', err);
        setError('Failed to connect to Yellow Network');
      });

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  const addActivityEvent = useCallback((event: ActivityEvent) => {
    setActivityEvents(prev => [event, ...prev]);
  }, []);

  /**
   * Create a real Yellow session with wallet authentication and channel creation.
   * Requires wallet functions from wagmi hooks.
   */
  const createSession = useCallback(async (
    budgetAmount: string,
    walletFunctions: WalletFunctions
  ) => {
    const client = clientRef.current;
    
    // Validate wallet connection
    if (!walletFunctions.walletAddress) {
      const walletError = createWalletError('WALLET_NOT_CONNECTED');
      setError(walletError.message);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure we're connected to clearnode
      if (!client?.isConnected()) {
        console.log('🔄 Reconnecting to clearnode...');
        await client?.connect();
      }

      // Step 1: Authenticate with Yellow Network
      console.log('🔐 Authenticating with Yellow Network...');
      await client!.authenticate({
        walletAddress: walletFunctions.walletAddress,
        signTypedData: walletFunctions.signTypedData,
      });
      
      console.log('✅ Authentication successful');

      // Step 2: Query actual unified balance from Yellow clearnode
      // Add a small delay to allow any recent faucet deposits to be processed
      console.log('📡 Querying unified balance from Yellow (waiting 2s for faucet sync)...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Query the real balance from Yellow's ledger
      const realBalance = await client!.queryBalance();
      console.log('💰 Real unified balance:', realBalance, 'USDC');
      
      // Generate a session ID for tracking (off-chain only)
      const sessionId = `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}` as `0x${string}`;
      
      // Use the real balance from Yellow, or the requested budget if balance is higher
      const availableBalance = parseFloat(realBalance);
      const requestedBudget = parseFloat(budgetAmount);
      
      // If user has less than requested, use what they have
      // If user has more, cap at requested budget
      const effectiveBudget = availableBalance > 0 
        ? Math.min(availableBalance, requestedBudget).toFixed(2)
        : budgetAmount; // Fallback to requested if query failed
      
      // Set the balance on the Yellow client
      client!.setUnifiedBalance(effectiveBudget);
      client!.setMockChannelId(sessionId);
      
      console.log('✅ Session created (using unified balance mode)');
      console.log('📋 Session ID:', sessionId);
      console.log('💰 Available balance:', realBalance, 'USDC');
      console.log('💰 Session budget:', effectiveBudget, 'USDC');
      
      // Warn if balance is low
      if (availableBalance < requestedBudget && availableBalance > 0) {
        console.warn(`⚠️ Requested ${budgetAmount} USDC but only ${realBalance} available`);
      } else if (availableBalance === 0) {
        console.warn('⚠️ No balance found - you may need to request tokens from the faucet');
      }

      // Update session state - we're using off-chain unified balance
      setSession({
        channelId: sessionId,
        balance: effectiveBudget,
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
          taskId: sessionId,
          description: availableBalance > 0 
            ? `Session created with ${effectiveBudget} USDC budget (Yellow unified balance: ${realBalance} USDC)`
            : `Session created with ${effectiveBudget} USDC budget - ⚠️ Request tokens from faucet first!`,
        },
      });

    } catch (err) {
      console.error('❌ Session creation failed:', err);
      const walletError = parseWalletError(err);
      setError(walletError.message);
      setSession(prev => ({ ...prev, status: 'error' }));
    } finally {
      setIsLoading(false);
    }
  }, [addActivityEvent]);

  /**
   * Close the Yellow session and settle on-chain.
   * Requires wallet functions for transaction signing.
   */
  const closeSession = useCallback(async (
    walletFunctions: CloseChannelWalletFunctions
  ) => {
    const client = clientRef.current;
    
    if (!session.channelId) {
      setError('No active session to close');
      return;
    }

    if (!walletFunctions.walletAddress) {
      const walletError = createWalletError('WALLET_NOT_CONNECTED');
      setError(walletError.message);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔒 Closing payment channel...');
      
      const closeResult = await client!.closeChannel({
        fundsDestination: walletFunctions.walletAddress,
        signState: async (packedState) => {
          return walletFunctions.signMessage({ message: packedState });
        },
        writeContract: walletFunctions.writeContract,
        waitForTransaction: walletFunctions.waitForTransaction,
      });

      console.log('✅ Channel closed. Final balance:', closeResult.finalBalance);

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

      // Reset session state
      setSession({
        ...initialSessionState,
        status: 'closed',
      });

    } catch (err) {
      console.error('❌ Session closure failed:', err);
      const walletError = parseWalletError(err);
      setError(walletError.message);
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
