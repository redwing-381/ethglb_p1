'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GlowingButton } from '@/components/ui/glowing-button';
import { BorderBeam } from '@/components/ui/border-beam';
import { Input } from '@/components/ui/input';
import { SessionState } from '@/types';
import type { WalletFunctions, CloseChannelWalletFunctions } from '@/types/wallet';
import type { ApprovalStatus, ChannelLifecycleStatus } from '@/hooks/use-yellow-session';
import { requestFaucetTokens } from '@/lib/yellow';
import { formatUSDC } from '@/lib/utils';
import {
  Search, FileText, Loader2, CheckCircle2, Link2, Plug, KeyRound,
  Trash2, HardDrive, Coins, Lock, XCircle, Droplets, Zap, Power,
  ExternalLink, Shield, Wifi
} from 'lucide-react';

interface SessionManagerProps {
  session: SessionState;
  isLoading: boolean;
  error: string | null;
  approvalStatus: ApprovalStatus;
  lifecycleStatus?: ChannelLifecycleStatus;
  onCreateSession: (budgetAmount: string, walletFunctions: WalletFunctions) => Promise<void>;
  onCloseSession: (walletFunctions: CloseChannelWalletFunctions) => Promise<void>;
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
  session, isLoading, error, approvalStatus, lifecycleStatus,
  onCreateSession, onCloseSession,
  walletAddress, isWalletConnected, signTypedData, writeContract,
  waitForTransaction, signMessage, readContract, currentChainId,
  switchChain, walletClient,
}: SessionManagerProps) {
  const [budgetInput, setBudgetInput] = useState('5');
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRequestFaucet = async () => {
    if (!walletAddress) return;
    setFaucetLoading(true);
    setFaucetMessage(null);
    try {
      const result = await requestFaucetTokens(walletAddress);
      if (result.success) {
        setFaucetMessage({
          type: 'success',
          text: `${result.amount || '10'} ytest.usd received! Wait a few seconds, then click "Create Session" to use them.`,
        });
      } else {
        setFaucetMessage({ type: 'error', text: result.error || 'Failed to request tokens' });
      }
    } catch (err) {
      setFaucetMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to request tokens' });
    } finally {
      setFaucetLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!budgetInput || parseFloat(budgetInput) <= 0) return;
    if (!isWalletConnected || !walletAddress) return;
    const walletFunctions: WalletFunctions = {
      signTypedData, writeContract, waitForTransaction, signMessage,
      readContract, walletAddress, currentChainId, switchChain, walletClient,
    };
    await onCreateSession(budgetInput, walletFunctions);
  };

  const handleCloseSession = async () => {
    if (!isWalletConnected || !walletAddress) return;
    const walletFunctions: CloseChannelWalletFunctions = {
      writeContract, waitForTransaction, signMessage,
      walletAddress, currentChainId, switchChain,
    };
    await onCloseSession(walletFunctions);
  };

  const isActive = session.status === 'active';
  const hasSession = session.channelId !== null;
  const canCreateSession = isWalletConnected && !hasSession && !isLoading;
  const canCloseSession = isWalletConnected && hasSession && !isLoading;

  const totalSpent = session.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const initialBalance = hasSession && session.createdAt
    ? parseFloat(session.balance) + totalSpent : 0;
  const percentRemaining = initialBalance > 0
    ? (parseFloat(session.balance) / initialBalance) * 100 : 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Agent Session</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {isActive
                  ? session.channelId?.startsWith('unified-')
                    ? 'Gasless mode — instant transfers via Yellow'
                    : 'On-chain session active'
                  : hasSession ? 'Session closed' : 'Fund a session to start'}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={session.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        {/* Approval Status */}
        {isLoading && approvalStatus.state !== 'idle' && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-300 flex items-center gap-1.5">
                {approvalStatus.state === 'checking_balance' && <><Search className="w-4 h-4" /> Checking token balance...</>}
                {approvalStatus.state === 'checking_allowance' && <><Search className="w-4 h-4" /> Checking token approval...</>}
                {approvalStatus.state === 'approval_needed' && <><FileText className="w-4 h-4" /> Approval required</>}
                {approvalStatus.state === 'approving' && <><Loader2 className="w-4 h-4 animate-spin" /> Approving tokens...</>}
                {approvalStatus.state === 'approval_confirmed' && <><CheckCircle2 className="w-4 h-4 text-green-400" /> Tokens approved</>}
                {approvalStatus.state === 'creating_channel' && <><Link2 className="w-4 h-4" /> Creating payment channel...</>}
                {approvalStatus.state === 'channel_created' && <><CheckCircle2 className="w-4 h-4 text-green-400" /> Channel created</>}
              </span>
            </div>
            {approvalStatus.currentBalance !== undefined && (
              <div className="text-xs text-blue-400 space-y-1">
                <div>Balance: {(Number(approvalStatus.currentBalance) / 1_000_000).toFixed(2)} USDC</div>
                {approvalStatus.currentAllowance !== undefined && (
                  <div>Current Allowance: {(Number(approvalStatus.currentAllowance) / 1_000_000).toFixed(2)} USDC</div>
                )}
                {approvalStatus.requiredAmount !== undefined && (
                  <div>Required: {(Number(approvalStatus.requiredAmount) / 1_000_000).toFixed(2)} USDC</div>
                )}
              </div>
            )}
            {approvalStatus.approvalTxHash && (
              <div className="text-xs text-blue-400">
                <a href={`https://sepolia.etherscan.io/tx/${approvalStatus.approvalTxHash}`}
                  target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View approval tx
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <div className={`w-2 h-2 rounded-full ${['checking_balance','checking_allowance','approval_needed','approving','approval_confirmed','creating_channel','channel_created'].includes(approvalStatus.state) ? 'bg-blue-400' : 'bg-muted'}`} />
              <span>Check Balance</span>
              <div className="flex-1 h-px bg-blue-500/20" />
              <div className={`w-2 h-2 rounded-full ${['checking_allowance','approval_needed','approving','approval_confirmed','creating_channel','channel_created'].includes(approvalStatus.state) ? 'bg-blue-400' : 'bg-muted'}`} />
              <span>Check Approval</span>
              <div className="flex-1 h-px bg-blue-500/20" />
              <div className={`w-2 h-2 rounded-full ${['approving','approval_confirmed','creating_channel','channel_created'].includes(approvalStatus.state) ? 'bg-blue-400' : 'bg-muted'}`} />
              <span>Approve</span>
              <div className="flex-1 h-px bg-blue-500/20" />
              <div className={`w-2 h-2 rounded-full ${['creating_channel','channel_created'].includes(approvalStatus.state) ? 'bg-blue-400' : 'bg-muted'}`} />
              <span>Create</span>
            </div>
          </div>
        )}

        {/* Channel Lifecycle Status */}
        {lifecycleStatus && lifecycleStatus.stage !== 'idle' && (
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-purple-300 flex items-center gap-1.5">
                {lifecycleStatus.stage === 'connecting' && <><Plug className="w-4 h-4" /> Connecting to Yellow Network...</>}
                {lifecycleStatus.stage === 'authenticating' && <><KeyRound className="w-4 h-4" /> Authenticating...</>}
                {lifecycleStatus.stage === 'checking_channels' && <><Search className="w-4 h-4" /> Checking existing channels...</>}
                {lifecycleStatus.stage === 'cleaning_up' && <><Trash2 className="w-4 h-4" /> Cleaning up stale channels...</>}
                {lifecycleStatus.stage === 'creating_channel' && <><HardDrive className="w-4 h-4" /> Creating channel on-chain...</>}
                {lifecycleStatus.stage === 'waiting_create_index' && <><Loader2 className="w-4 h-4 animate-spin" /> Waiting for Node indexing...</>}
                {lifecycleStatus.stage === 'funding_channel' && <><Coins className="w-4 h-4" /> Funding channel...</>}
                {lifecycleStatus.stage === 'channel_active' && <><CheckCircle2 className="w-4 h-4 text-green-400" /> Channel active</>}
                {lifecycleStatus.stage === 'closing_channel' && <><Lock className="w-4 h-4" /> Closing channel...</>}
                {lifecycleStatus.stage === 'waiting_close_index' && <><Loader2 className="w-4 h-4 animate-spin" /> Waiting for Node indexing...</>}
                {lifecycleStatus.stage === 'complete' && <><CheckCircle2 className="w-4 h-4 text-green-400" /> Lifecycle complete</>}
                {lifecycleStatus.stage === 'error' && <><XCircle className="w-4 h-4 text-red-400" /> Error occurred</>}
              </span>
            </div>
            {lifecycleStatus.channelId && (
              <div className="text-xs text-purple-400">
                Channel: {lifecycleStatus.channelId.slice(0, 10)}...{lifecycleStatus.channelId.slice(-6)}
              </div>
            )}
            {lifecycleStatus.message && (
              <div className="text-xs text-purple-300 font-medium">{lifecycleStatus.message}</div>
            )}
            {lifecycleStatus.createTxHash && (
              <div className="text-xs text-purple-400">
                <a href={`https://sepolia.etherscan.io/tx/${lifecycleStatus.createTxHash}`}
                  target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View Create TX on Etherscan
                </a>
              </div>
            )}
            {lifecycleStatus.closeTxHash && (
              <div className="text-xs text-purple-400">
                <a href={`https://sepolia.etherscan.io/tx/${lifecycleStatus.closeTxHash}`}
                  target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View Close TX on Etherscan
                </a>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-purple-400">
              <div className={`w-2 h-2 rounded-full ${['connecting','authenticating','checking_channels','cleaning_up','creating_channel','waiting_create_index','funding_channel','channel_active','closing_channel','waiting_close_index','complete'].includes(lifecycleStatus.stage) ? 'bg-purple-400' : 'bg-muted'}`} />
              <span>Connect</span>
              <div className="flex-1 h-px bg-purple-500/20" />
              <div className={`w-2 h-2 rounded-full ${['creating_channel','waiting_create_index','funding_channel','channel_active','closing_channel','waiting_close_index','complete'].includes(lifecycleStatus.stage) ? 'bg-purple-400' : 'bg-muted'}`} />
              <span>Create</span>
              <div className="flex-1 h-px bg-purple-500/20" />
              <div className={`w-2 h-2 rounded-full ${['channel_active','closing_channel','waiting_close_index','complete'].includes(lifecycleStatus.stage) ? 'bg-purple-400' : 'bg-muted'}`} />
              <span>Fund</span>
              <div className="flex-1 h-px bg-purple-500/20" />
              <div className={`w-2 h-2 rounded-full ${['closing_channel','waiting_close_index','complete'].includes(lifecycleStatus.stage) ? 'bg-purple-400' : 'bg-muted'}`} />
              <span>Close</span>
              <div className="flex-1 h-px bg-purple-500/20" />
              <div className={`w-2 h-2 rounded-full ${['complete'].includes(lifecycleStatus.stage) ? 'bg-purple-400' : 'bg-muted'}`} />
              <span>Done</span>
            </div>
          </div>
        )}

        {/* Error states */}
        {approvalStatus.state === 'balance_check_failed' && approvalStatus.error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            <div className="font-medium mb-1">Insufficient Balance</div>
            <div>{approvalStatus.error}</div>
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={handleRequestFaucet}
                disabled={!isWalletConnected || faucetLoading} className="text-xs">
                Use Faucet
              </Button>
            </div>
          </div>
        )}
        {approvalStatus.state === 'approval_rejected' && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
            <div className="font-medium mb-1">Approval Cancelled</div>
            <div>You cancelled the token approval. Click &quot;Create Channel&quot; to try again.</div>
          </div>
        )}
        {approvalStatus.state === 'approval_failed' && approvalStatus.error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            <div className="font-medium mb-1">Approval Failed</div>
            <div>{approvalStatus.error}</div>
          </div>
        )}
        {approvalStatus.state === 'channel_creation_failed' && approvalStatus.error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            <div className="font-medium mb-1">Channel Creation Failed</div>
            <div>{approvalStatus.error}</div>
            <div className="mt-1 text-xs">Your token approval is still valid.</div>
          </div>
        )}

        {!isWalletConnected && !hasSession && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
            Connect your wallet to create a session
          </div>
        )}

        {!hasSession ? (
          <div className="space-y-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-blue-300">Need test tokens?</p>
                  <p className="text-xs text-blue-400">Get free ytest.usd from Yellow&apos;s faucet</p>
                </div>
                <GlowingButton onClick={handleRequestFaucet}
                  disabled={!isWalletConnected || faucetLoading} glowColor="#3B82F6" className="h-8 text-xs">
                  <span className="inline-flex items-center gap-1">
                    {faucetLoading ? 'Requesting...' : <><Droplets className="w-3.5 h-3.5 shrink-0" /> Get Tokens</>}
                  </span>
                </GlowingButton>
              </div>
              {faucetMessage && (
                <p className={`text-xs mt-2 ${faucetMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {faucetMessage.text}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Session Budget (USDC)</label>
              <div className="flex gap-2">
                <Input type="number" min="0.1" step="0.1" value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)} placeholder="5.00"
                  className="flex-1" disabled={isLoading} />
                <GlowingButton onClick={handleCreateSession}
                  disabled={!canCreateSession || !budgetInput} glowColor="#10B981">
                  <span className="inline-flex items-center gap-1.5">
                    {isLoading ? 'Creating...' : <><Zap className="w-4 h-4 shrink-0" /> Start Session</>}
                  </span>
                </GlowingButton>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses Yellow Network&apos;s unified balance for instant, gasless transfers
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative p-4 bg-secondary/50 rounded-lg overflow-hidden">
              {isActive && <BorderBeam lightColor="#10B981" lightWidth={200} duration={6} borderWidth={1} />}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Session Balance</span>
                <span className="text-xl font-bold tabular-nums">{formatUSDC(session.balance)}</span>
              </div>
              <div className="w-full bg-border rounded-full h-2 mb-2">
                <div className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, percentRemaining))}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Spent: {totalSpent.toFixed(2)} USDC</span>
                <span>{percentRemaining.toFixed(0)}% remaining</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-secondary/30 rounded-lg">
                <p className="text-muted-foreground mb-1">Channel ID</p>
                <p className="font-mono text-foreground">{truncateId(session.channelId || '')}</p>
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg">
                <p className="text-muted-foreground mb-1">Payments</p>
                <p className="text-foreground font-semibold text-lg">{session.payments.length}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {session.channelId && session.channelId.startsWith('0x') ? (
                <GlowingButton className="flex-1" onClick={handleCloseSession}
                  disabled={!canCloseSession} glowColor="#EF4444">
                  <span className="inline-flex items-center gap-1.5">
                    {isLoading ? 'Settling...' : <><Lock className="w-4 h-4 shrink-0" /> Settle & Close</>}
                  </span>
                </GlowingButton>
              ) : (
                <GlowingButton className="flex-1" onClick={() => window.location.reload()} glowColor="#F59E0B">
                  <span className="inline-flex items-center gap-1.5"><Power className="w-4 h-4 shrink-0" /> End Session</span>
                </GlowingButton>
              )}
            </div>
            {session.channelId?.startsWith('0x') ? (
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> On-Chain Mode: Channel will be settled on Sepolia when closed
              </div>
            ) : (
              <div className="p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" /> Gasless Mode: Transfers are instant with no on-chain settlement needed
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
    disconnected: 'bg-secondary text-muted-foreground',
    creating: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    closing: 'bg-yellow-100 text-yellow-700',
    closed: 'bg-secondary text-muted-foreground',
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
