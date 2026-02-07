'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedList } from '@/components/ui/animated-list';
import type { ActivityEvent } from '@/types';
import { useEnsName } from '@/hooks/use-ens-name';
import { formatUSDC } from '@/lib/utils';
import { getDisplayName, getAgentInfo, getEnsDisplayName } from '@/lib/ai';
import { useEnsAgentRegistry } from '@/hooks/use-ens-agent-registry';
import type { EnsAgentConfig } from '@/types';

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxEvents?: number;
}

// Payment event component with ENS subname resolution
function PaymentEvent({ event, ensAgents }: { event: Extract<ActivityEvent, { type: 'payment' }>; ensAgents: EnsAgentConfig[] }) {
  const { ensName: fromEnsName } = useEnsName(event.data.from);
  const { ensName: toEnsName } = useEnsName(event.data.to);
  
  // Prefer ENS subname from registry, then wagmi ENS, then truncated address
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
        {toAgent && <span className="text-sm">{toAgent.icon}</span>}
        <span className="text-gray-600 truncate">{fromDisplayName}</span>
        <span className="text-gray-400">→</span>
        <span className={`font-medium truncate ${isSuccess ? 'text-gray-900' : 'text-red-600'}`}>
          {toDisplayName}
        </span>
        {!isSuccess && <span className="text-red-500 text-xs">✗</span>}
      </div>
      <span className={`font-medium flex-shrink-0 text-xs ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
        {formatUSDC(event.data.amount)}
      </span>
    </div>
  );
}

// Platform fee event component
function PlatformFeeEvent({ event }: { event: Extract<ActivityEvent, { type: 'platform_fee' }> }) {
  const isSuccess = event.data.success !== false;
  
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-gray-600 truncate">{event.data.from}</span>
        <span className="text-gray-400">→</span>
        <span className={`font-medium truncate ${isSuccess ? 'text-purple-700' : 'text-red-600'}`}>
          {event.data.to}
        </span>
        <span className="text-purple-500 text-xs">({event.data.feePercentage}% fee)</span>
        {!isSuccess && <span className="text-red-500 text-xs">✗</span>}
      </div>
      <span className={`font-medium flex-shrink-0 text-xs ${isSuccess ? 'text-purple-600' : 'text-red-600'}`}>
        {formatUSDC(event.data.amount)}
      </span>
    </div>
  );
}

// Balance sync event component
function BalanceSyncEvent({ event }: { event: Extract<ActivityEvent, { type: 'balance_sync' }> }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`${event.data.isStale ? 'text-yellow-600' : 'text-blue-600'}`}>
        💰 Balance: {formatUSDC(event.data.balance)}
        {event.data.isStale && <span className="text-yellow-500 text-xs ml-1">(stale)</span>}
      </span>
    </div>
  );
}

// Settlement event component - shows on-chain settlement with Etherscan link
function SettlementEvent({ event }: { event: Extract<ActivityEvent, { type: 'settlement' }> }) {
  return (
    <div className="p-2 bg-green-50 border border-green-200 rounded-lg space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium text-green-800">
        ⛓️ On-Chain Settlement Complete
      </div>
      <div className="text-xs text-green-700 space-y-0.5">
        <div>Total Spent: {event.data.totalSpent} USDC</div>
        <div>Returned: {event.data.finalBalance} USDC</div>
      </div>
      <a 
        href={event.data.etherscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 hover:underline"
      >
        🔗 View on Etherscan →
      </a>
    </div>
  );
}

export function ActivityFeed({ events, maxEvents = 20 }: ActivityFeedProps) {
  const displayEvents = events.slice(0, maxEvents);
  const { agents: ensAgents } = useEnsAgentRegistry();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  const renderEventContent = (event: ActivityEvent) => {
    switch (event.type) {
      case 'payment':
        return <PaymentEvent event={event} ensAgents={ensAgents} />;
      case 'platform_fee':
        return <PlatformFeeEvent event={event} />;
      case 'balance_sync':
        return <BalanceSyncEvent event={event} />;
      case 'settlement':
        return <SettlementEvent event={event} />;
      case 'task_start':
        return (
          <span className="text-sm text-gray-700">
            Started: {event.data.description.slice(0, 60)}
            {event.data.description.length > 60 ? '...' : ''}
          </span>
        );
      case 'task_complete':
        return (
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-700 font-medium">Completed</span>
            <span className="text-xs text-gray-500">{event.data.totalCost} USDC</span>
          </div>
        );
      case 'subtask_start':
        return (
          <span className="text-sm text-gray-600">
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
            <span className="text-xs font-semibold text-gray-400 tracking-wider">
              ── Round {event.data.round} of {event.data.totalRounds} ──
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
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Activity</CardTitle>
          {events.length > 0 && (
            <span className="text-xs text-gray-500">
              {events.filter(e => e.type === 'payment' || e.type === 'platform_fee').length} payments
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {displayEvents.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            <AnimatedList className="space-y-2">
              {displayEvents.map((event) => (
                <div 
                  key={event.id}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="text-gray-400 flex-shrink-0 w-12">{formatTime(event.timestamp)}</span>
                  <div className="flex-1 min-w-0">
                    {renderEventContent(event)}
                  </div>
                </div>
              ))}
            </AnimatedList>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No activity yet</p>
            <p className="text-xs text-gray-400 mt-1">Start a debate to see payments flow</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
