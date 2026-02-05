'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SessionState } from '@/types';
import type { WalletFunctions, CloseChannelWalletFunctions } from '@/types/wallet';
import { requestFaucetTokens } from '@/lib/yellow-faucet';
import { DepositFlow } from '@/components/deposit-flow';

interface SessionManagerProps {
  session: SessionState;
  isLoading: boolean;
  error: string | null;
  onCreateSession: (budgetAmount: string, walletFunctions: WalletFunctions) => Promise<void>;
  onCloseSession: (walletFunctions: CloseChannelWalletFunctions) => Promise<void>;
  
  // Wallet functions from wagmi hooks
  walletAddress: `0x${string}` | undefined;
  isWalletConnected: boolean;
  signTypedData: WalletFunctions['signTypedData'];
  writeContract: WalletFunctions['writeContract'];
  waitForTransaction: WalletFunctions['waitForTransaction'];
  signMessage: WalletFunctions['signMessage'];
  currentChainId?: number;
  switchChain?: (chainId: number) => Promise<void>;
}

export function SessionManager({
  session,
  isLoading,
  error,
  onCreateSession,
  onCloseSession,
  walletAddress,
  isWalletConnected,
  signTypedData,
  writeContract,
  waitForTransaction,
  signMessage,
  currentChainId,
  switchChain,
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
      walletAddress,
      currentChainId,
      switchChain,
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
            ? 'Session active - agents can execute tasks'
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
                      {isLoading ? 'Creating...' : 'Create Session'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    This amount will be locked in a payment channel for agent tasks
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
                onClick={handleCloseSession}
                disabled={!canCloseSession}
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
