'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedCard } from '@/components/ui/animated-card';
import { AnimatedList } from '@/components/ui/animated-list';
import { BorderBeam } from '@/components/ui/border-beam';
import type { ActivityEvent } from '@/types';
import { useEnsName } from '@/hooks/use-ens-name';
import { formatUSDC } from '@/lib/utils';
import { getDisplayName, getAgentInfo, getEnsDisplayName } from '@/lib/ai';
import { useEnsAgentRegistry } from '@/hooks/use-ens-agent-registry';
import type { EnsAgentConfig } from '@/types';
import { Coins, Link2, ExternalLink } from 'lucide-react';

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxEvents?: number;
}

function PaymentEvent({ event, ensAgents }: { event: Extract<ActivityEvent, { type: 'payment' }>; ensAgents: EnsAgentConfig[] }) {
  const { ensName: fromEnsName } = useEnsName(event.data.from);
  const { ensName: toEnsName } = useEnsName(event.data.to);
  const fromDisplayName = ensAgents.length > 0
    ? getEnsDisplayName(event.data.from, ensAgents)
    : getDisplayName(event.data.from, fromEnsName);
  const toDisplayName = ensAgents.length > 0
    ? getEnsDisplayName(event.data.to, ensAgents)
    : getDisplayName(event.data.to, toEnsName);
  const toAgent = getAgentInfo(event.data.to);
  const isSuccess = event.data.success !== false;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {toAgent && <span className="text-sm text-primary"><Coins className="w-3.5 h-3.5 inline" /></span>}
        <span className="text-muted-foreground truncate">{fromDisplayName}</span>
        <span className="text-border">→</span>
        <span className={`font-medium truncate ${isSuccess ? 'text-foreground' : 'text-red-600'}`}>{toDisplayName}</span>
        {!isSuccess && <span className="text-red-500 text-xs">✗</span>}
      </div>
      <span className={`font-medium flex-shrink-0 text-xs ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
        {formatUSDC(event.data.amount)}
      </span>
    </div>
  );
}

function PlatformFeeEvent({ event }: { event: Extract<ActivityEvent, { type: 'platform_fee' }> }) {
  const isSuccess = event.data.success !== false;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-muted-foreground truncate">{event.data.from}</span>
        <span className="text-border">→</span>
        <span className={`font-medium truncate ${isSuccess ? 'text-purple-700' : 'text-red-600'}`}>{event.data.to}</span>
        <span className="text-purple-500 text-xs">({event.data.feePercentage}% fee)</span>
        {!isSuccess && <span className="text-red-500 text-xs">✗</span>}
      </div>
      <span className={`font-medium flex-shrink-0 text-xs ${isSuccess ? 'text-purple-600' : 'text-red-600'}`}>
        {formatUSDC(event.data.amount)}
      </span>
    </div>
  );
}

function BalanceSyncEvent({ event }: { event: Extract<ActivityEvent, { type: 'balance_sync' }> }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`flex items-center gap-1 ${event.data.isStale ? 'text-yellow-600' : 'text-blue-600'}`}>
        <Coins className="w-3.5 h-3.5" /> Balance: {formatUSDC(event.data.balance)}
        {event.data.isStale && <span className="text-yellow-500 text-xs ml-1">(stale)</span>}
      </span>
    </div>
  );
}

function SettlementEvent({ event }: { event: Extract<ActivityEvent, { type: 'settlement' }> }) {
  return (
    <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg space-y-1">
      <div className="flex items-center gap-1.5 text-sm font-medium text-green-400">
        <Link2 className="w-4 h-4" /> On-Chain Settlement Complete
      </div>
      <div className="text-xs text-green-300 space-y-0.5">
        <div>Total Spent: {event.data.totalSpent} USDC</div>
        <div>Returned: {event.data.finalBalance} USDC</div>
      </div>
      <a href={event.data.etherscanUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 hover:underline">
        <ExternalLink className="w-3 h-3" /> View on Etherscan
      </a>
    </div>
  );
}

export function ActivityFeed({ events, maxEvents = 20 }: ActivityFeedProps) {
  const displayEvents = events.slice(0, maxEvents);
  const { agents: ensAgents } = useEnsAgentRegistry();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const renderEventContent = (event: ActivityEvent) => {
    switch (event.type) {
      case 'payment': return <PaymentEvent event={event} ensAgents={ensAgents} />;
      case 'platform_fee': return <PlatformFeeEvent event={event} />;
      case 'balance_sync': return <BalanceSyncEvent event={event} />;
      case 'settlement': return <SettlementEvent event={event} />;
      case 'task_start':
        return (
          <span className="text-sm text-foreground/80">
            Started: {event.data.description.slice(0, 60)}{event.data.description.length > 60 ? '...' : ''}
          </span>
        );
      case 'task_complete':
        return (
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-700 font-medium">Completed</span>
            <span className="text-xs text-muted-foreground">{event.data.totalCost} USDC</span>
          </div>
        );
      case 'subtask_start':
        return (
          <span className="text-sm text-muted-foreground">
            {event.data.agentName}: {event.data.description.slice(0, 50)}...
          </span>
        );
      case 'subtask_complete':
        return (
          <span className={`text-sm ${event.data.success ? 'text-green-700' : 'text-red-700'}`}>
            {event.data.agentName} {event.data.success ? 'done' : 'failed'}
          </span>
        );
      case 'round_marker':
        return (
          <div className="text-center py-1">
            <span className="text-xs font-semibold text-muted-foreground tracking-wider">
              — Round {event.data.round} of {event.data.totalRounds} —
            </span>
          </div>
        );
      case 'error':
        return (
          <div className="text-sm text-red-700">
            <span className="font-medium">Error:</span> {event.data.message}
            {event.data.code && <span className="text-xs text-red-500 ml-1">({event.data.code})</span>}
          </div>
        );
      default: return null;
    }
  };

  const hasPayments = events.some(e => e.type === 'payment' || e.type === 'platform_fee');

  return (
    <AnimatedCard className="relative overflow-hidden">
      {hasPayments && <BorderBeam lightColor="#F59E0B" lightWidth={200} duration={7} borderWidth={1.5} />}
      <Card className="border-0 shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Activity</CardTitle>
            {hasPayments && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
          </div>
          {events.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {events.filter(e => e.type === 'payment' || e.type === 'platform_fee').length} payments
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {displayEvents.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            <AnimatedList className="flex-col space-y-2">
              {displayEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground flex-shrink-0 w-12">{formatTime(event.timestamp)}</span>
                  <div className="flex-1 min-w-0">{renderEventContent(event)}</div>
                </div>
              ))}
            </AnimatedList>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Start a debate to see payments flow</p>
          </div>
        )}
      </CardContent>
      </Card>
    </AnimatedCard>
  );
}
