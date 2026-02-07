'use client';

import { useState, useCallback } from 'react';
import { WalletConnect } from '@/components/wallet-connect';
import { SessionManager } from '@/components/session-manager';
import { TaskInput } from '@/components/task-input';
import { ActivityFeed } from '@/components/activity-feed';
import { ResultsPanel } from '@/components/results-panel';
import { AgentCardsSection } from '@/components/agent-cards-section';
import { ToastContainer } from '@/components/toast';
import { useYellowSession } from '@/hooks/use-yellow-session';
import { useToast } from '@/hooks/use-toast';
import { getNitroliteClient, getPlatformAddress, PLATFORM_CONFIG } from '@/lib/yellow';
import { getAgentAddress } from '@/lib/yellow';
import { AGENT_CONFIGS } from '@/lib/ai';
import { getErrorMessage } from '@/lib/utils';
import type { CostBreakdown } from '@/lib/payment';
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

import { AgentEarnings, type AgentEarningsMap } from '@/components/agent-earnings';

interface TaskResult {
  content: string;
  totalCost: string;
  agentsUsed: string[];
  subTaskCount: number;
  costBreakdown?: CostBreakdown;
}

export default function Home() {
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();
  
  const {
    session,
    isLoading,
    error,
    approvalStatus,
    lifecycleStatus,
    createSession,
    closeSession,
    activityEvents,
    addActivityEvent,
    recordPayment,
  } = useYellowSession();

  const { toasts, showToast, dismissToast } = useToast();

  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const [agentEarnings, setAgentEarnings] = useState<AgentEarningsMap>({});

  // Use the transaction receipt hook for waiting
  const { isLoading: isWaitingForTx } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  // Wrapper functions to match the expected signatures
  const signTypedData = useCallback(async (params: {
    domain: { name: string };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> => {
    return signTypedDataAsync({
      domain: params.domain,
      types: params.types,
      primaryType: params.primaryType,
      message: params.message,
    });
  }, [signTypedDataAsync]);

  const writeContract = useCallback(async (params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: unknown[];
    value?: bigint;
    gas?: bigint;
  }): Promise<`0x${string}`> => {
    // Build the config object, only including value/gas if defined
    const config = {
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    } as Parameters<typeof writeContractAsync>[0];
    
    if (params.value !== undefined) {
      (config as Record<string, unknown>).value = params.value;
    }
    
    // CRITICAL: Pass gas limit to avoid wagmi's auto-estimation
    // which can exceed Sepolia's block gas limit
    if (params.gas !== undefined) {
      (config as Record<string, unknown>).gas = params.gas;
      console.log('⛽ Using explicit gas limit:', params.gas.toString());
    }
    
    const hash = await writeContractAsync(config);
    setPendingTxHash(hash);
    return hash;
  }, [writeContractAsync]);

  const waitForTransaction = useCallback(async (hash: `0x${string}`): Promise<void> => {
    // Set the pending hash and wait for the receipt
    setPendingTxHash(hash);
    // Poll until transaction is confirmed
    return new Promise((resolve, reject) => {
      const checkReceipt = async () => {
        try {
          // Simple polling approach - in production use a more robust method
          const maxAttempts = 60;
          let attempts = 0;
          
          while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;
            
            // Check if we're still waiting
            if (!isWaitingForTx) {
              resolve();
              return;
            }
          }
          
          reject(new Error('Transaction confirmation timeout'));
        } catch (err) {
          reject(err);
        }
      };
      
      checkReceipt();
    });
  }, [isWaitingForTx]);

  const signMessage = useCallback(async (params: {
    message: `0x${string}` | string;
  }): Promise<`0x${string}`> => {
    return signMessageAsync({ message: params.message });
  }, [signMessageAsync]);

  const switchChain = useCallback(async (targetChainId: number): Promise<void> => {
    await switchChainAsync({ chainId: targetChainId });
  }, [switchChainAsync]);

  const readContract = useCallback(async <T,>(params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: unknown[];
  }): Promise<T> => {
    // Use viem's readContract directly
    const { readContract: viemReadContract } = await import('viem/actions');
    const { createPublicClient, http } = await import('viem');
    const { sepolia } = await import('viem/chains');
    
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });
    
    const result = await viemReadContract(publicClient, {
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
    });
    
    return result as T;
  }, []);

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
      // Get the Nitrolite client (authenticated during session creation)
      const nitroliteClient = getNitroliteClient();
      
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

      console.log('📦 API Response:', JSON.stringify(data, null, 2));

      // Execute Yellow transfers using NitroliteSDKClient (has the correct session key)
      console.log('🔍 Checking Nitrolite client authentication status...');
      console.log('🔍 isAuthenticated:', nitroliteClient.isAuthenticated());
      console.log('🔍 payments array:', data.payments);
      console.log('🔍 payments length:', data.payments?.length);
      
      if (data.payments && data.payments.length > 0) {
        if (nitroliteClient.isAuthenticated()) {
          console.log('💸 Executing Yellow transfers via NitroliteSDKClient...');
          let allPaymentsSuccessful = true;
          
          for (const payment of data.payments) {
            // Check if this is a platform fee payment
            const isPlatformFee = payment.to.toLowerCase() === getPlatformAddress().toLowerCase();
            
            if (isPlatformFee) {
              console.log(`💸 Paying platform fee: ${payment.amount} USDC...`);
              try {
                const result = await nitroliteClient.transfer(payment.to as `0x${string}`, payment.amount);
                console.log(`✅ Platform fee transfer complete. TX ID: ${result.transactionId}`);
                
                // Track platform earnings
                setAgentEarnings((prev: AgentEarningsMap) => ({
                  ...prev,
                  platform: {
                    name: 'AgentPay Platform',
                    address: payment.to,
                    earned: ((prev.platform ? parseFloat(prev.platform.earned) : 0) + parseFloat(payment.amount)).toFixed(2),
                    icon: '🏦',
                  },
                }));
                
                addActivityEvent({
                  id: `event-platform-fee-${result.transactionId}`,
                  type: 'platform_fee',
                  timestamp: Date.now(),
                  data: {
                    from: 'You',
                    to: 'AgentPay Platform',
                    amount: payment.amount,
                    asset: 'USDC',
                    feePercentage: PLATFORM_CONFIG.FEE_PERCENTAGE,
                    transactionId: result.transactionId,
                    success: true,
                  },
                });
              } catch (transferError) {
                const errorMsg = transferError instanceof Error ? transferError.message : 'Unknown error';
                console.error(`❌ Platform fee transfer failed: ${errorMsg}`);
                allPaymentsSuccessful = false;
                
                const platformFeeErrorId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                addActivityEvent({
                  id: `event-platform-fee-error-${platformFeeErrorId}`,
                  type: 'platform_fee',
                  timestamp: Date.now(),
                  data: {
                    from: 'You',
                    to: 'AgentPay Platform',
                    amount: payment.amount,
                    asset: 'USDC',
                    feePercentage: PLATFORM_CONFIG.FEE_PERCENTAGE,
                    success: false,
                    error: errorMsg,
                  },
                });
              }
              continue;
            }
            
            // Find the agent type from the payment destination
            const agentTypes = ['orchestrator', 'researcher', 'writer'] as const;
            const agentType = agentTypes.find(type => 
              getAgentAddress(type).toLowerCase() === payment.to.toLowerCase()
            );
            
            if (agentType) {
              const config = AGENT_CONFIGS[agentType];
              console.log(`💸 Paying ${config.name} (${payment.to}) ${payment.amount} USDC...`);
              
              try {
                const result = await nitroliteClient.transfer(payment.to as `0x${string}`, payment.amount);
                console.log(`✅ Transfer to ${config.name} complete. TX ID: ${result.transactionId}`);
                
                // Track agent earnings
                setAgentEarnings((prev: AgentEarningsMap) => ({
                  ...prev,
                  [agentType]: {
                    name: config.name,
                    address: payment.to,
                    earned: ((prev[agentType] ? parseFloat(prev[agentType].earned) : 0) + parseFloat(payment.amount)).toFixed(2),
                    icon: agentType === 'orchestrator' ? '🧠' : agentType === 'researcher' ? '🔍' : '✍️',
                  },
                }));
                
                addActivityEvent({
                  id: `event-payment-${result.transactionId}`,
                  type: 'payment',
                  timestamp: Date.now(),
                  data: {
                    from: 'You',
                    to: config.name,
                    amount: payment.amount,
                    asset: 'USDC',
                    transactionId: result.transactionId,
                    success: true,
                  },
                });
              } catch (transferError) {
                const errorMsg = transferError instanceof Error ? transferError.message : 'Unknown error';
                console.error(`❌ Transfer to ${config.name} failed: ${errorMsg}`);
                allPaymentsSuccessful = false;
                
                const paymentErrorId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                addActivityEvent({
                  id: `event-payment-error-${paymentErrorId}`,
                  type: 'payment',
                  timestamp: Date.now(),
                  data: {
                    from: 'You',
                    to: config.name,
                    amount: payment.amount,
                    asset: 'USDC',
                    success: false,
                    error: errorMsg,
                  },
                });
                
                addActivityEvent({
                  id: `event-error-${paymentErrorId}-detail`,
                  type: 'error',
                  timestamp: Date.now(),
                  data: { 
                    message: `Payment to ${config.name} failed: ${errorMsg}`,
                    code: 'TRANSFER_FAILED',
                  },
                });
                
                throw new Error(`Payment to ${config.name} failed: ${errorMsg}`);
              }
            } else {
              console.warn(`⚠️ Unknown payment destination: ${payment.to}`);
            }
          }
          
          if (!allPaymentsSuccessful) {
            showToast('warning', 'Some payments failed. Check activity feed for details.');
          }
        } else {
          console.warn('⚠️ Nitrolite client not authenticated - cannot execute payments');
          const authErrorId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          addActivityEvent({
            id: `event-error-${authErrorId}`,
            type: 'error',
            timestamp: Date.now(),
            data: { 
              message: 'Nitrolite client not authenticated. Please reconnect your session.',
              code: 'NOT_AUTHENTICATED',
            },
          });
          throw new Error('Nitrolite client not authenticated. Please reconnect your session.');
        }
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
      
      // Show success toast
      showToast('success', 'Task completed successfully!');
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setTaskError(errorMessage);
      const catchErrorId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      addActivityEvent({
        id: `event-error-${catchErrorId}`,
        type: 'error',
        timestamp: Date.now(),
        data: { message: errorMessage },
      });
      
      // Show error toast
      showToast('error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h1 className="text-lg font-semibold text-gray-900">AgentPay</h1>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!isWalletConnected ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              AI Agent Marketplace
            </h2>
            <p className="text-gray-600 mb-8">
              Hire AI agents to complete tasks. They get paid instantly using Yellow Network's state channels.
            </p>
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <p className="text-sm text-gray-500 mb-4">Connect your wallet to get started</p>
              <WalletConnect />
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
              <span>Powered by Yellow Network</span>
              <span>•</span>
              <span>LI.FI</span>
              <span>•</span>
              <span>ENS</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Session & Agents */}
            <div className="space-y-6">
              <SessionManager
                session={session}
                isLoading={isLoading}
                error={error}
                approvalStatus={approvalStatus}
                lifecycleStatus={lifecycleStatus}
                onCreateSession={createSession}
                onCloseSession={closeSession}
                walletAddress={walletAddress}
                isWalletConnected={isWalletConnected}
                signTypedData={signTypedData}
                writeContract={writeContract}
                waitForTransaction={waitForTransaction}
                signMessage={signMessage}
                readContract={readContract}
                currentChainId={chainId}
                switchChain={switchChain}
                walletClient={walletClient}
              />
              
              <AgentCardsSection />
              
              {Object.keys(agentEarnings).length > 0 && (
                <AgentEarnings earnings={agentEarnings} />
              )}
            </div>

            {/* Right column - Task & Activity */}
            <div className="lg:col-span-2 space-y-6">
              <TaskInput
                isSessionActive={session.status === 'active' && !isProcessing}
                onSubmit={handleTaskSubmit}
              />

              <ResultsPanel
                result={taskResult}
                isLoading={isProcessing}
                error={taskError}
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
