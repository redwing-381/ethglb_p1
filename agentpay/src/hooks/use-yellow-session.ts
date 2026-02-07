'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { SessionState, SessionStatus, ActivityEvent } from '@/types';
import type { WalletFunctions, CloseChannelWalletFunctions } from '@/types/wallet';
import { 
  YellowClient, 
  getYellowClient, 
  ConnectionStatus,
  SessionStatus as YellowSessionStatus,
} from '@/lib/yellow';
import { createWalletError, parseWalletError } from '@/lib/blockchain';
import {
  getNitroliteClient,
  resetNitroliteClient,
  type NitroliteStage,
} from '@/lib/yellow';

// Channel lifecycle stages (mapped from NitroliteStage)
export type ChannelLifecycleStage =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'checking_channels'
  | 'cleaning_up'
  | 'creating_channel'
  | 'waiting_create_index'
  | 'funding_channel'
  | 'channel_active'
  | 'closing_channel'
  | 'waiting_close_index'
  | 'complete'
  | 'error';

// Approval flow state machine
export type ApprovalState = 
  | 'idle'
  | 'checking_balance'
  | 'checking_allowance'
  | 'approval_needed'
  | 'approving'
  | 'approval_confirmed'
  | 'creating_channel'
  | 'channel_created'
  | 'balance_check_failed'
  | 'allowance_check_failed'
  | 'approval_rejected'
  | 'approval_failed'
  | 'channel_creation_failed';

export interface ApprovalStatus {
  state: ApprovalState;
  currentAllowance?: bigint;
  currentBalance?: bigint;
  requiredAmount?: bigint;
  approvalTxHash?: `0x${string}`;
  channelTxHash?: `0x${string}`;
  error?: string;
}



export interface ChannelLifecycleStatus {
  stage: ChannelLifecycleStage;
  channelId?: string;
  balance?: string;
  message?: string;
  createTxHash?: string;
  closeTxHash?: string;
  waitSecondsRemaining?: number;
}

interface UseYellowSessionReturn {
  // State
  session: SessionState;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Approval state
  approvalStatus: ApprovalStatus;
  
  // Channel lifecycle state (for full lifecycle mode)
  lifecycleStatus: ChannelLifecycleStatus;
  
  // Actions - now require wallet functions for real operations
  createSession: (budgetAmount: string, walletFunctions: WalletFunctions) => Promise<void>;
  closeSession: (walletFunctions: CloseChannelWalletFunctions) => Promise<void>;
  recordPayment: (amount: number) => void;
  
  // Full lifecycle actions
  executeFullLifecycle: (agentPayments: Array<{ address: `0x${string}`; amount: string }>) => Promise<Array<{ address: string; txId: number }>>;
  
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
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>({ state: 'idle' });
  const [lifecycleStatus, setLifecycleStatus] = useState<ChannelLifecycleStatus>({ stage: 'idle' });
  
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
   * Create a Yellow session.
   * 
   * If walletClient is provided, uses the Nitrolite SDK for full on-chain channel lifecycle.
   * Otherwise, falls back to Unified Balance Mode (gasless, instant transfers).
   * 
   * On-Chain Mode Flow:
   * 1. Initialize Nitrolite SDK with wallet client
   * 2. Authenticate with Yellow Network
   * 3. Create channel on-chain (depositAndCreate)
   * 4. Wait for Node indexing
   * 5. Resize channel to fund from unified balance
   * 6. Session is active
   * 
   * Unified Balance Mode Flow:
   * 1. Authenticate with session key
   * 2. Query unified balance (from faucet)
   * 3. Session is active - can make instant transfers
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
    setApprovalStatus({ state: 'idle' });
    setLifecycleStatus({ stage: 'connecting' });

    try {
      // Check if we have a wallet client for on-chain mode
      const hasWalletClient = !!walletFunctions.walletClient;
      
      if (hasWalletClient) {
        // ============================================================
        // ON-CHAIN MODE: Use Nitrolite SDK for full channel lifecycle
        // ============================================================
        console.log('🔗 Using ON-CHAIN MODE with Nitrolite SDK');
        
        // Reset any existing Nitrolite client
        resetNitroliteClient();
        
        // Create new Nitrolite client with callbacks
        const nitroliteClient = getNitroliteClient({
          onStageChange: (stage, message) => {
            // Map Nitrolite stages to our lifecycle stages
            const stageMap: Record<NitroliteStage, ChannelLifecycleStage> = {
              'idle': 'idle',
              'connecting': 'connecting',
              'authenticating': 'authenticating',
              'checking_channels': 'checking_channels',
              'creating_channel': 'creating_channel',
              'waiting_index': 'waiting_create_index',
              'resizing_channel': 'funding_channel',
              'channel_active': 'channel_active',
              'closing_channel': 'closing_channel',
              'transferring': 'channel_active',
              'complete': 'complete',
              'error': 'error',
            };
            setLifecycleStatus(prev => ({ 
              ...prev, 
              stage: stageMap[stage] || 'idle', 
              message 
            }));
            console.log(`📊 Nitrolite stage: ${stage}${message ? ` - ${message}` : ''}`);
          },
          onTransactionSubmitted: (txHash, type) => {
            if (type === 'create') {
              setLifecycleStatus(prev => ({ ...prev, createTxHash: txHash }));
            } else {
              setLifecycleStatus(prev => ({ ...prev, closeTxHash: txHash }));
            }
            console.log(`📝 ${type} transaction: ${txHash}`);
            console.log(`🔗 Etherscan: https://sepolia.etherscan.io/tx/${txHash}`);
          },
          onError: (err) => {
            setError(err.message);
            setLifecycleStatus(prev => ({ ...prev, stage: 'error' }));
          },
        });
        
        // Initialize with wallet client
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await nitroliteClient.initialize(
          walletFunctions.walletClient as any,
          walletFunctions.walletAddress
        );
        
        // Authenticate Nitrolite client
        await nitroliteClient.authenticate();
        
        // Check unified balance first
        const unifiedBalance = await nitroliteClient.getUnifiedBalance();
        const unifiedBalanceNum = parseFloat(unifiedBalance) / 1_000_000; // Convert from micro-units
        const requiredAmount = parseFloat(budgetAmount);
        
        console.log('💰 Unified balance:', unifiedBalanceNum.toFixed(2), 'USDC');
        console.log('💰 Required:', requiredAmount.toFixed(2), 'USDC');
        
        if (unifiedBalanceNum < requiredAmount) {
          setApprovalStatus({ 
            state: 'balance_check_failed',
            currentBalance: BigInt(Math.floor(unifiedBalanceNum * 1_000_000)),
            requiredAmount: BigInt(Math.floor(requiredAmount * 1_000_000)),
            error: `Insufficient unified balance. You have ${unifiedBalanceNum.toFixed(2)} USDC but need ${budgetAmount} USDC. Use the faucet to get test tokens.`,
          });
          setError(`Insufficient unified balance. You have ${unifiedBalanceNum.toFixed(2)} USDC but need ${budgetAmount} USDC.`);
          setLifecycleStatus({ stage: 'error' });
          return;
        }
        
        // Create and fund channel on-chain
        const result = await nitroliteClient.createAndFundChannel(budgetAmount);
        
        console.log('✅ On-chain channel created and funded!');
        console.log('📋 Channel ID:', result.channelId);
        console.log('📝 TX Hash:', result.txHash);
        console.log('💰 Balance:', result.balance, 'USDC');
        
        setApprovalStatus({ 
          state: 'channel_created',
          channelTxHash: result.txHash as `0x${string}`,
        });
        setLifecycleStatus({ 
          stage: 'channel_active', 
          channelId: result.channelId, 
          balance: result.balance,
          createTxHash: result.txHash,
          message: 'Channel active (On-Chain Mode)',
        });

        // Update session state
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
            description: `On-chain channel created with ${budgetAmount} USDC budget. TX: ${result.txHash.slice(0, 10)}...`,
          },
        });

        console.log('✅ Session ready for agent payments!');
        
      } else {
        // ============================================================
        // UNIFIED BALANCE MODE: Gasless, instant transfers
        // ============================================================
        console.log('⚡ Using UNIFIED BALANCE MODE (gasless)');
        
        // Ensure we're connected to clearnode
        if (!client?.isConnected()) {
          console.log('🔄 Reconnecting to clearnode...');
          await client?.connect();
        }

        // Step 1: Authenticate with Yellow Network
        setLifecycleStatus({ stage: 'authenticating', message: 'Authenticating with Yellow Network...' });
        console.log('🔐 Authenticating with Yellow Network...');
        await client!.authenticate({
          walletAddress: walletFunctions.walletAddress,
          signTypedData: walletFunctions.signTypedData,
        });
        
        console.log('✅ Authentication successful');

        // Step 2: Check UNIFIED BALANCE (off-chain)
        setApprovalStatus({ state: 'checking_balance' });
        setLifecycleStatus({ stage: 'checking_channels', message: 'Checking unified balance...' });
        
        console.log('🔍 Checking Yellow unified balance...');
        const unifiedBalance = await client!.queryBalance();
        const unifiedBalanceNum = parseFloat(unifiedBalance);
        const requiredAmount = parseFloat(budgetAmount);
        
        console.log('✅ Unified balance check:', {
          balance: unifiedBalance,
          required: budgetAmount,
          hasEnough: unifiedBalanceNum >= requiredAmount,
        });

        if (unifiedBalanceNum < requiredAmount) {
          setApprovalStatus({ 
            state: 'balance_check_failed',
            currentBalance: BigInt(Math.floor(unifiedBalanceNum * 1_000_000)),
            requiredAmount: BigInt(Math.floor(requiredAmount * 1_000_000)),
            error: `Insufficient unified balance. You have ${unifiedBalance} USDC but need ${budgetAmount} USDC. Use the faucet to get test tokens.`,
          });
          setError(`Insufficient unified balance. You have ${unifiedBalance} USDC but need ${budgetAmount} USDC.`);
          setLifecycleStatus({ stage: 'error' });
          return;
        }

        // Step 3: Session is now active (Unified Balance Mode - no on-chain channel needed)
        // Generate a session ID for tracking
        const sessionId = `session_${Date.now()}_${walletFunctions.walletAddress.slice(2, 10)}`;
        
        console.log('✅ Unified Balance Mode - Session active!');
        console.log('📋 Session ID:', sessionId);
        console.log('💰 Available balance:', unifiedBalance, 'USDC');
        console.log('💰 Budget:', budgetAmount, 'USDC');

        setApprovalStatus({ state: 'channel_created' });
        setLifecycleStatus({ 
          stage: 'channel_active', 
          channelId: sessionId, 
          balance: budgetAmount,
          message: 'Session active (Unified Balance Mode)',
        });

        // Update session state
        setSession({
          channelId: sessionId,
          balance: budgetAmount,
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
            description: `Session created with ${budgetAmount} USDC budget (Unified Balance Mode - instant, gasless transfers)`,
          },
        });

        console.log('✅ Session ready for instant, gasless agent payments!');
      }

    } catch (err) {
      console.error('❌ Session creation failed:', err);
      const walletError = parseWalletError(err);
      setError(walletError.message);
      setSession(prev => ({ ...prev, status: 'error' }));
      setLifecycleStatus({ stage: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [addActivityEvent]);

  /**
   * Close the Yellow session.
   * 
   * For on-chain channels (ID starts with 0x): Uses Nitrolite SDK to close on-chain.
   * For Unified Balance Mode (ID starts with session_): Just ends the session locally.
   */
  const closeSession = useCallback(async (
    walletFunctions: CloseChannelWalletFunctions
  ) => {
    if (!session.channelId) {
      setError('No active session to close');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLifecycleStatus({ stage: 'closing_channel', channelId: session.channelId });

    try {
      const isOnChainChannel = session.channelId.startsWith('0x');
      
      if (isOnChainChannel) {
        // ============================================================
        // ON-CHAIN MODE: Close channel using Nitrolite SDK
        // ============================================================
        console.log('🔗 Closing on-chain channel...');
        
        const nitroliteClient = getNitroliteClient();
        
        if (!nitroliteClient.isAuthenticated()) {
          throw new Error('Nitrolite client not authenticated. Please create a new session.');
        }
        
        const result = await nitroliteClient.closeChannel();
        
        console.log('✅ Channel closed on-chain');
        console.log('📝 TX Hash:', result.txHash);
        console.log('💰 Final balance returned:', result.finalBalance, 'USDC');
        console.log('🔗 Etherscan:', `https://sepolia.etherscan.io/tx/${result.txHash}`);
        
        const totalSpent = (parseFloat(session.balance) - parseFloat(result.finalBalance)).toFixed(2);
        
        setLifecycleStatus({ 
          stage: 'complete', 
          balance: result.finalBalance,
          closeTxHash: result.txHash,
          message: 'Channel closed and settled on-chain',
        });

        // Add settlement event with Etherscan link
        const settlementId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        addActivityEvent({
          id: `evt_settlement_${settlementId}`,
          type: 'settlement',
          timestamp: Date.now(),
          data: {
            channelId: session.channelId || '',
            txHash: result.txHash,
            finalBalance: result.finalBalance,
            totalSpent,
            etherscanUrl: `https://sepolia.etherscan.io/tx/${result.txHash}`,
          },
        });

        // Add task complete event
        addActivityEvent({
          id: `evt_complete_${settlementId}`,
          type: 'task_complete',
          timestamp: Date.now(),
          data: {
            taskId: session.channelId || '',
            totalCost: totalSpent,
            agentsUsed: [...new Set(session.payments.map(p => p.to))],
          },
        });
        
      } else {
        // ============================================================
        // UNIFIED BALANCE MODE: Just end the session locally
        // ============================================================
        console.log('🔒 Closing session (Unified Balance Mode)...');
        
        // In Unified Balance Mode, we just end the session locally
        // Funds remain in the unified balance
        
        const totalSpent = session.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const finalBalance = (parseFloat(session.balance) - totalSpent).toFixed(2);
        
        console.log('✅ Session closed');
        console.log('💰 Total spent:', totalSpent.toFixed(2), 'USDC');
        console.log('💰 Remaining in unified balance:', finalBalance, 'USDC');
        
        setLifecycleStatus({ 
          stage: 'complete', 
          balance: finalBalance,
          message: 'Session closed (funds remain in unified balance)',
        });

        // Add activity event
        addActivityEvent({
          id: `evt_${Date.now()}`,
          type: 'task_complete',
          timestamp: Date.now(),
          data: {
            taskId: session.channelId || '',
            totalCost: totalSpent.toFixed(2),
            agentsUsed: [...new Set(session.payments.map(p => p.to))],
          },
        });
      }

      // Reset session state
      setSession({
        ...initialSessionState,
        status: 'closed',
      });

    } catch (err) {
      console.error('❌ Session closure failed:', err);
      const walletError = parseWalletError(err);
      setError(walletError.message);
      setLifecycleStatus({ stage: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [session.channelId, session.payments, session.balance, addActivityEvent]);

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
    
    // Sync balance with Yellow Network after payment
    const client = clientRef.current;
    if (client?.isAuthenticated()) {
      client.queryBalance()
        .then(balance => {
          console.log('💰 Balance synced from Yellow:', balance);
          setSession(prev => ({ ...prev, balance }));
          
          // Add balance sync event with unique ID
          const syncId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          addActivityEvent({
            id: `evt_balance_sync_${syncId}`,
            type: 'balance_sync',
            timestamp: Date.now(),
            data: {
              balance,
              isStale: false,
            },
          });
        })
        .catch(err => {
          console.warn('⚠️ Balance sync failed:', err);
          // Add stale balance event with unique ID
          const syncId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          addActivityEvent({
            id: `evt_balance_sync_stale_${syncId}`,
            type: 'balance_sync',
            timestamp: Date.now(),
            data: {
              balance: '0',
              isStale: true,
            },
          });
        });
    }
  }, [addActivityEvent]);

  const clearActivity = useCallback(() => {
    setActivityEvents([]);
  }, []);

  /**
   * Execute the full Yellow channel lifecycle for agent payments.
   * 
   * Flow: Create Channel → Fund → Close → Transfer to Agents
   * 
   * This is the correct pattern from Yellow's sample code.
   * Transfers only work after the channel is closed.
   */
  const executeFullLifecycle = useCallback(async (
    agentPayments: Array<{ address: `0x${string}`; amount: string }>
  ): Promise<Array<{ address: string; txId: number }>> => {
    const client = clientRef.current;
    
    if (!client) {
      throw new Error('Yellow client not initialized');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Add activity event for lifecycle start
      addActivityEvent({
        id: `evt_lifecycle_start_${Date.now()}`,
        type: 'task_start',
        timestamp: Date.now(),
        data: {
          taskId: 'channel_lifecycle',
          description: 'Starting full channel lifecycle for agent payments',
        },
      });
      
      // Execute transfers using the Yellow client
      const results: Array<{ address: string; txId: number }> = [];
      
      for (const payment of agentPayments) {
        const result = await client.transfer(payment.address, payment.amount);
        results.push({
          address: payment.address,
          txId: result.transactionId,
        });
        
        // Add activity event for each payment
        addActivityEvent({
          id: `evt_payment_${result.transactionId}`,
          type: 'payment',
          timestamp: Date.now(),
          data: {
            from: 'Platform',
            to: payment.address,
            amount: payment.amount,
            asset: 'USDC',
            transactionId: result.transactionId,
          },
        });
      }
      
      // Add completion event
      addActivityEvent({
        id: `evt_lifecycle_complete_${Date.now()}`,
        type: 'task_complete',
        timestamp: Date.now(),
        data: {
          taskId: 'channel_lifecycle',
          totalCost: agentPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2),
          agentsUsed: agentPayments.map(p => p.address),
        },
      });
      
      return results;
      
    } catch (err) {
      console.error('❌ Full lifecycle execution failed:', err);
      setError(err instanceof Error ? err.message : 'Lifecycle execution failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [addActivityEvent]);

  return {
    session,
    connectionStatus,
    isConnected: connectionStatus === 'connected' || connectionStatus === 'authenticated',
    isLoading,
    error,
    approvalStatus,
    lifecycleStatus,
    createSession,
    closeSession,
    recordPayment,
    executeFullLifecycle,
    activityEvents,
    addActivityEvent,
    clearActivity,
  };
}
