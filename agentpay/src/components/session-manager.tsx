'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SessionState } from '@/types';
import type { WalletFunctions, CloseChannelWalletFunctions } from '@/types/wallet';
import type { ApprovalStatus, ChannelLifecycleStatus } from '@/hooks/use-yellow-session';
import { requestFaucetTokens } from '@/lib/yellow';
import { DepositFlow } from '@/components/deposit-flow';
import { formatUSDC } from '@/lib/utils';

interface SessionManagerProps {
  session: SessionState;
  isLoading: boolean;
  error: string | null;
  approvalStatus: ApprovalStatus;
  lifecycleStatus?: ChannelLifecycleStatus;
  onCreateSession: (budgetAmount: string, walletFunctions: WalletFunctions) => Promise<void>;
  onCloseSession: (walletFunctions: CloseChannelWalletFunctions) => Promise<void>;
  
  // Wallet functions from wagmi hooks
  walletAddress: `0x${string}` | undefined;
  isWalletConnected: boolean;
  signTypedData: WalletFunctions['signTypedData'];
  writeContract: WalletFunctions['writeContract'];
  waitForTransaction: WalletFunctions['waitForTransaction'];
  signMessage: WalletFunctions['signMessage'];
  readContract: WalletFunctions['readContract'];
  currentChainId?: number;
  switchChain?: (chainId: number) => Promise<void>;
  walletClient?: unknown;
}

export function SessionManager({
  session,
  isLoading,
  error,
  approvalStatus,
  lifecycleStatus,
  onCreateSession,
  onCloseSession,
  walletAddress,
  isWalletConnected,
  signTypedData,
  writeContract,
  waitForTransaction,
  signMessage,
  readContract,
  currentChainId,
  switchChain,
  walletClient,
}: SessionManagerProps) {
  const [budgetInput, setBudgetInput] = useState('5');
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDepositFlow, setShowDepositFlow] = useState(false);

  const handleRequestFaucet = async () => {
    if (!walletAddress) return;
    
    setFaucetLoading(true);
    setFaucetMessage(null);
    
    try {
      const result = await requestFaucetTokens(walletAddress);
      
      if (result.success) {
        setFaucetMessage({
          type: 'success',
          text: `✅ ${result.amount || '10'} ytest.usd received! Wait a few seconds, then click "Create Session" to use them.`,
        });
      } else {
        setFaucetMessage({
          type: 'error',
          text: result.error || 'Failed to request tokens',
        });
      }
    } catch (err) {
      setFaucetMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to request tokens',
      });
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleDepositComplete = () => {
    setShowDepositFlow(false);
    setFaucetMessage({
      type: 'success',
      text: '✅ Bridge completed! Your funds should arrive shortly. You can now create a session.',
    });
  };

  const handleCreateSession = async () => {
    if (!budgetInput || parseFloat(budgetInput) <= 0) return;
    
    if (!isWalletConnected || !walletAddress) {
      // This shouldn't happen as button should be disabled, but just in case
      return;
    }

    // Build wallet functions object
    const walletFunctions: WalletFunctions = {
      signTypedData,
      writeContract,
      waitForTransaction,
      signMessage,
      readContract,
      walletAddress,
      currentChainId,
      switchChain,
      walletClient,
    };

    await onCreateSession(budgetInput, walletFunctions);
  };

  const handleCloseSession = async () => {
    if (!isWalletConnected || !walletAddress) return;

    const walletFunctions: CloseChannelWalletFunctions = {
      writeContract,
      waitForTransaction,
      signMessage,
      walletAddress,
      currentChainId,
      switchChain,
    };

    await onCloseSession(walletFunctions);
  };

  const isActive = session.status === 'active';
  const hasSession = session.channelId !== null;
  const canCreateSession = isWalletConnected && !hasSession && !isLoading;
  const canCloseSession = isWalletConnected && hasSession && !isLoading;

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
            ? session.channelId?.startsWith('unified-')
              ? 'Gasless mode active - instant transfers via Yellow Network'
              : 'Session active - agents can execute tasks'
            : hasSession
            ? 'Session closed'
            : 'Create a session to start using agents'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Approval Status Display */}
        {isLoading && approvalStatus.state !== 'idle' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                {approvalStatus.state === 'checking_balance' && '🔍 Checking token balance...'}
                {approvalStatus.state === 'checking_allowance' && '🔍 Checking token approval...'}
                {approvalStatus.state === 'approval_needed' && '📝 Approval required'}
                {approvalStatus.state === 'approving' && '⏳ Approving tokens...'}
                {approvalStatus.state === 'approval_confirmed' && '✅ Tokens approved'}
                {approvalStatus.state === 'creating_channel' && '⛓️ Creating payment channel...'}
                {approvalStatus.state === 'channel_created' && '✅ Channel created'}
              </span>
            </div>

            {/* Show balance and allowance info */}
            {approvalStatus.currentBalance !== undefined && (
              <div className="text-xs text-blue-700 space-y-1">
                <div>Balance: {(Number(approvalStatus.currentBalance) / 1_000_000).toFixed(2)} USDC</div>
                {approvalStatus.currentAllowance !== undefined && (
                  <div>Current Allowance: {(Number(approvalStatus.currentAllowance) / 1_000_000).toFixed(2)} USDC</div>
                )}
                {approvalStatus.requiredAmount !== undefined && (
                  <div>Required: {(Number(approvalStatus.requiredAmount) / 1_000_000).toFixed(2)} USDC</div>
                )}
              </div>
            )}

            {/* Show transaction hashes */}
            {approvalStatus.approvalTxHash && (
              <div className="text-xs text-blue-600">
                <a 
                  href={`https://sepolia.etherscan.io/tx/${approvalStatus.approvalTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  View approval tx →
                </a>
              </div>
            )}

            {/* Progress indicator */}
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <div className={`w-2 h-2 rounded-full ${['checking_balance', 'checking_allowance', 'approval_needed', 'approving', 'approval_confirmed', 'creating_channel', 'channel_created'].includes(approvalStatus.state) ? 'bg-blue-500' : 'bg-gray-300'}`} />
              <span>Check Balance</span>
              <div className="flex-1 h-px bg-blue-200" />
              <div className={`w-2 h-2 rounded-full ${['checking_allowance', 'approval_needed', 'approving', 'approval_confirmed', 'creating_channel', 'channel_created'].includes(approvalStatus.state) ? 'bg-blue-500' : 'bg-gray-300'}`} />
              <span>Check Approval</span>
              <div className="flex-1 h-px bg-blue-200" />
              <div className={`w-2 h-2 rounded-full ${['approving', 'approval_confirmed', 'creating_channel', 'channel_created'].includes(approvalStatus.state) ? 'bg-blue-500' : 'bg-gray-300'}`} />
              <span>Approve</span>
              <div className="flex-1 h-px bg-blue-200" />
              <div className={`w-2 h-2 rounded-full ${['creating_channel', 'channel_created'].includes(approvalStatus.state) ? 'bg-blue-500' : 'bg-gray-300'}`} />
              <span>Create</span>
            </div>
          </div>
        )}

        {/* Channel Lifecycle Status Display */}
        {lifecycleStatus && lifecycleStatus.stage !== 'idle' && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-purple-900">
                {lifecycleStatus.stage === 'connecting' && '🔌 Connecting to Yellow Network...'}
                {lifecycleStatus.stage === 'authenticating' && '🔐 Authenticating...'}
                {lifecycleStatus.stage === 'checking_channels' && '🔍 Checking existing channels...'}
                {lifecycleStatus.stage === 'cleaning_up' && '🧹 Cleaning up stale channels...'}
                {lifecycleStatus.stage === 'creating_channel' && '🏗️ Creating channel on-chain...'}
                {lifecycleStatus.stage === 'waiting_create_index' && '⏳ Waiting for Node indexing...'}
                {lifecycleStatus.stage === 'funding_channel' && '💰 Funding channel...'}
                {lifecycleStatus.stage === 'channel_active' && '✅ Channel active'}
                {lifecycleStatus.stage === 'closing_channel' && '🔒 Closing channel...'}
                {lifecycleStatus.stage === 'waiting_close_index' && '⏳ Waiting for Node indexing...'}
                {lifecycleStatus.stage === 'complete' && '✅ Lifecycle complete'}
                {lifecycleStatus.stage === 'error' && '❌ Error occurred'}
              </span>
            </div>

            {/* Show channel info */}
            {lifecycleStatus.channelId && (
              <div className="text-xs text-purple-700">
                Channel: {lifecycleStatus.channelId.slice(0, 10)}...{lifecycleStatus.channelId.slice(-6)}
              </div>
            )}

            {/* Show message (e.g., countdown info) */}
            {lifecycleStatus.message && (
              <div className="text-xs text-purple-600 font-medium">
                {lifecycleStatus.message}
              </div>
            )}

            {/* Etherscan links for on-chain transactions */}
            {lifecycleStatus.createTxHash && (
              <div className="text-xs text-purple-600">
                <a 
                  href={`https://sepolia.etherscan.io/tx/${lifecycleStatus.createTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  <span>🔗</span>
                  <span>View Create TX on Etherscan →</span>
                </a>
              </div>
            )}
            {lifecycleStatus.closeTxHash && (
              <div className="text-xs text-purple-600">
                <a 
                  href={`https://sepolia.etherscan.io/tx/${lifecycleStatus.closeTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  <span>🔗</span>
                  <span>View Close TX on Etherscan →</span>
                </a>
              </div>
            )}

            {/* Lifecycle progress indicator */}
            <div className="flex items-center gap-1 text-xs text-purple-600">
              <div className={`w-2 h-2 rounded-full ${['connecting', 'authenticating', 'checking_channels', 'cleaning_up', 'creating_channel', 'waiting_create_index', 'funding_channel', 'channel_active', 'closing_channel', 'waiting_close_index', 'complete'].includes(lifecycleStatus.stage) ? 'bg-purple-500' : 'bg-gray-300'}`} />
              <span>Connect</span>
              <div className="flex-1 h-px bg-purple-200" />
              <div className={`w-2 h-2 rounded-full ${['creating_channel', 'waiting_create_index', 'funding_channel', 'channel_active', 'closing_channel', 'waiting_close_index', 'complete'].includes(lifecycleStatus.stage) ? 'bg-purple-500' : 'bg-gray-300'}`} />
              <span>Create</span>
              <div className="flex-1 h-px bg-purple-200" />
              <div className={`w-2 h-2 rounded-full ${['channel_active', 'closing_channel', 'waiting_close_index', 'complete'].includes(lifecycleStatus.stage) ? 'bg-purple-500' : 'bg-gray-300'}`} />
              <span>Fund</span>
              <div className="flex-1 h-px bg-purple-200" />
              <div className={`w-2 h-2 rounded-full ${['closing_channel', 'waiting_close_index', 'complete'].includes(lifecycleStatus.stage) ? 'bg-purple-500' : 'bg-gray-300'}`} />
              <span>Close</span>
              <div className="flex-1 h-px bg-purple-200" />
              <div className={`w-2 h-2 rounded-full ${['complete'].includes(lifecycleStatus.stage) ? 'bg-purple-500' : 'bg-gray-300'}`} />
              <span>Done</span>
            </div>
          </div>
        )}

        {/* Error states for approval */}
        {approvalStatus.state === 'balance_check_failed' && approvalStatus.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <div className="font-medium mb-1">Insufficient Balance</div>
            <div>{approvalStatus.error}</div>
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestFaucet}
                disabled={!isWalletConnected || faucetLoading}
                className="text-xs"
              >
                Use Faucet
              </Button>
            </div>
          </div>
        )}

        {approvalStatus.state === 'approval_rejected' && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
            <div className="font-medium mb-1">Approval Cancelled</div>
            <div>You cancelled the token approval. Click &quot;Create Channel&quot; to try again.</div>
          </div>
        )}

        {approvalStatus.state === 'approval_failed' && approvalStatus.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <div className="font-medium mb-1">Approval Failed</div>
            <div>{approvalStatus.error}</div>
          </div>
        )}

        {approvalStatus.state === 'channel_creation_failed' && approvalStatus.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <div className="font-medium mb-1">Channel Creation Failed</div>
            <div>{approvalStatus.error}</div>
            <div className="mt-1 text-xs">Your token approval is still valid.</div>
          </div>
        )}

        {!isWalletConnected && !hasSession && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
            Connect your wallet to create a session
          </div>
        )}

        {!hasSession ? (
          // Create session form
          <div className="space-y-4">
            {/* Show DepositFlow if enabled */}
            {showDepositFlow ? (
              <div className="space-y-4">
                <DepositFlow
                  onComplete={handleDepositComplete}
                  onCancel={() => setShowDepositFlow(false)}
                />
              </div>
            ) : (
              <>
                {/* Faucet Section */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-blue-800">Need test tokens?</p>
                      <p className="text-xs text-blue-600">Get free ytest.usd from Yellow&apos;s faucet</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRequestFaucet}
                      disabled={!isWalletConnected || faucetLoading}
                      className="bg-white"
                    >
                      {faucetLoading ? 'Requesting...' : '🚰 Get Tokens'}
                    </Button>
                  </div>
                  {faucetMessage && (
                    <p className={`text-xs mt-2 ${faucetMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {faucetMessage.text}
                    </p>
                  )}
                </div>

                {/* Cross-Chain Deposit Section */}
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-purple-800">Deposit from another chain</p>
                      <p className="text-xs text-purple-600">Bridge USDC from Ethereum, Polygon, Arbitrum, etc.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDepositFlow(true)}
                      disabled={!isWalletConnected}
                      className="bg-white"
                    >
                      🌉 Bridge
                    </Button>
                  </div>
                </div>

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
                      disabled={isLoading}
                    />
                    <Button 
                      onClick={handleCreateSession}
                      disabled={!canCreateSession || !budgetInput}
                    >
                      {isLoading ? 'Creating...' : 'Start Session'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Uses Yellow Network&apos;s unified balance for instant, gasless transfers
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          // Active session display
          <div className="space-y-4">
            {/* Balance display */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Session Balance</span>
                <span className="text-lg font-semibold">
                  {formatUSDC(session.balance)}
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
              {/* Show different buttons based on channel type */}
              {session.channelId && session.channelId.startsWith('0x') ? (
                // On-chain channel - show Settle & Close button
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleCloseSession}
                  disabled={!canCloseSession}
                >
                  {isLoading ? 'Settling...' : 'Settle & Close'}
                </Button>
              ) : (
                // Unified balance mode - show End Session button
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    // Reset session for unified balance mode
                    // No on-chain settlement needed
                    window.location.reload();
                  }}
                >
                  End Session
                </Button>
              )}
            </div>
            
            {/* Info about channel mode */}
            {session.channelId?.startsWith('0x') ? (
              <div className="p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700">
                🔗 On-Chain Mode: Channel will be settled on Sepolia when closed
              </div>
            ) : (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                ⚡ Gasless Mode: Transfers are instant with no on-chain settlement needed
              </div>
            )}
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
