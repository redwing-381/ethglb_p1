'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityEvent } from '@/types';
import { useEnsName } from '@/hooks/use-ens-name';
import { formatUSDC } from '@/lib/format';
import { getDisplayName, getAgentInfo } from '@/lib/agent-registry';
import { EnsBadge } from '@/components/ens-badge';
import { EmptyState, InboxIcon } from '@/components/empty-state';

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxEvents?: number;
}

// Payment event component with ENS name resolution and agent names
function PaymentEvent({ event }: { event: Extract<ActivityEvent, { type: 'payment' }> }) {
  const { ensName: fromEnsName } = useEnsName(event.data.from);
  const { ensName: toEnsName } = useEnsName(event.data.to);
  
  // Get display names using priority: ENS > Agent name > Truncated address
  const fromDisplayName = getDisplayName(event.data.from, fromEnsName);
  const toDisplayName = getDisplayName(event.data.to, toEnsName);
  
  // Check if addresses are agents
  const toAgent = getAgentInfo(event.data.to);
  
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span 
          className="text-gray-700 cursor-help font-medium truncate" 
          title={event.data.from}
        >
          {fromDisplayName}
        </span>
        {fromEnsName && <EnsBadge />}
        <span className="text-gray-400 flex-shrink-0">→</span>
        <div className="flex items-center gap-1.5 min-w-0">
          {toAgent && <span className="flex-shrink-0">{toAgent.icon}</span>}
          <span 
            className="font-medium text-gray-900 cursor-help truncate" 
            title={event.data.to}
          >
            {toDisplayName}
          </span>
          {toEnsName && <EnsBadge />}
        </div>
      </div>
      <span className="text-green-600 font-semibold flex-shrink-0 text-sm">
        {formatUSDC(event.data.amount)}
      </span>
    </div>
  );
}

export function ActivityFeed({ events, maxEvents = 20 }: ActivityFeedProps) {
  const displayEvents = events.slice(0, maxEvents);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'payment':
        return '💸';
      case 'task_start':
        return '🚀';
      case 'task_complete':
        return '✅';
      case 'subtask_start':
        return '⚙️';
      case 'subtask_complete':
        return '✓';
      case 'error':
        return '❌';
      default:
        return '•';
    }
  };

  const renderEventContent = (event: ActivityEvent) => {
    switch (event.type) {
      case 'payment':
        return <PaymentEvent event={event} />;
      case 'task_start':
        return (
          <span className="text-blue-700 font-medium">
            Task started: <span className="font-normal text-gray-700">{event.data.description.slice(0, 50)}
            {event.data.description.length > 50 ? '...' : ''}</span>
          </span>
        );
      case 'task_complete':
        return (
          <div className="flex items-center justify-between">
            <span className="text-green-700 font-medium">Task completed</span>
            <span className="text-xs text-gray-500 font-medium">
              {event.data.totalCost} USDC
            </span>
          </div>
        );
      case 'subtask_start':
        return (
          <span className="text-gray-700">
            <span className="font-medium">{event.data.agentName}</span> working on: {event.data.description.slice(0, 40)}...
          </span>
        );
      case 'subtask_complete':
        return (
          <span className={event.data.success ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
            {event.data.agentName} {event.data.success ? 'completed' : 'failed'}
          </span>
        );
      case 'error':
        return (
          <span className="text-red-700 font-medium">
            Error: <span className="font-normal">{event.data.message}</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3 border-b border-gray-100">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="text-gray-900">Activity Feed</span>
          {events.length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              {events.filter(e => e.type === 'payment').length} payments
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {displayEvents.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {displayEvents.map((event, index) => (
              <div 
                key={event.id}
                className="p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg text-sm flex items-start gap-3 border border-gray-100 animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <span className="flex-shrink-0 text-lg">{getEventIcon(event.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400 mb-1 font-medium">
                    {formatTime(event.timestamp)}
                  </div>
                  {renderEventContent(event)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={InboxIcon}
            title="No activity yet"
            description="Submit a task to see agent activity here"
          />
        )}
      </CardContent>
    </Card>
  );
}
