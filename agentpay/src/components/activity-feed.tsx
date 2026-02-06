'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityEvent } from '@/types';
import { useEnsName } from '@/hooks/use-ens-name';
import { formatUSDC } from '@/lib/utils';
import { getDisplayName, getAgentInfo } from '@/lib/ai';

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxEvents?: number;
}

// Payment event component with ENS name resolution and agent names
function PaymentEvent({ event }: { event: Extract<ActivityEvent, { type: 'payment' }> }) {
  const { ensName: fromEnsName } = useEnsName(event.data.from);
  const { ensName: toEnsName } = useEnsName(event.data.to);
  
  const fromDisplayName = getDisplayName(event.data.from, fromEnsName);
  const toDisplayName = getDisplayName(event.data.to, toEnsName);
  
  const toAgent = getAgentInfo(event.data.to);
  
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-gray-600 truncate">{fromDisplayName}</span>
        <span className="text-gray-400">→</span>
        <span className="text-gray-900 font-medium truncate">{toDisplayName}</span>
      </div>
      <span className="text-green-600 font-medium flex-shrink-0 text-xs">
        {formatUSDC(event.data.amount)}
      </span>
    </div>
  );
}

export function ActivityFeed({ events, maxEvents = 20 }: ActivityFeedProps) {
  const displayEvents = events.slice(0, maxEvents);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  const renderEventContent = (event: ActivityEvent) => {
    switch (event.type) {
      case 'payment':
        return <PaymentEvent event={event} />;
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
      case 'error':
        return (
          <span className="text-sm text-red-700">{event.data.message}</span>
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
              {events.filter(e => e.type === 'payment').length} payments
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {displayEvents.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
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
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No activity yet</p>
            <p className="text-xs text-gray-400 mt-1">Submit a task to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
