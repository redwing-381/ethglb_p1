'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityEvent } from '@/types';

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxEvents?: number;
}

export function ActivityFeed({ events, maxEvents = 20 }: ActivityFeedProps) {
  const displayEvents = events.slice(0, maxEvents);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'payment':
        return '💰';
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
        return (
          <div className="flex items-center justify-between">
            <span>
              <span className="text-gray-600">{event.data.from}</span>
              <span className="mx-2">→</span>
              <span className="font-medium">{event.data.to}</span>
            </span>
            <span className="text-green-600 font-medium">
              {event.data.amount} {event.data.asset}
            </span>
          </div>
        );
      case 'task_start':
        return (
          <span className="text-blue-600">
            Task started: {event.data.description.slice(0, 50)}
            {event.data.description.length > 50 ? '...' : ''}
          </span>
        );
      case 'task_complete':
        return (
          <div className="flex items-center justify-between">
            <span className="text-green-600">Task completed</span>
            <span className="text-sm text-gray-500">
              Total: {event.data.totalCost} USDC
            </span>
          </div>
        );
      case 'subtask_start':
        return (
          <span className="text-gray-600">
            {event.data.agentName} working on: {event.data.description.slice(0, 40)}...
          </span>
        );
      case 'subtask_complete':
        return (
          <span className={event.data.success ? 'text-green-600' : 'text-red-600'}>
            {event.data.agentName} {event.data.success ? 'completed' : 'failed'}
          </span>
        );
      case 'error':
        return (
          <span className="text-red-600">
            Error: {event.data.message}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Activity Feed</span>
          {events.length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              {events.filter(e => e.type === 'payment').length} payments
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayEvents.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {displayEvents.map((event) => (
              <div 
                key={event.id}
                className="p-2 bg-gray-50 rounded text-sm flex items-start gap-2"
              >
                <span className="flex-shrink-0">{getEventIcon(event.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400 mb-0.5">
                    {formatTime(event.timestamp)}
                  </div>
                  {renderEventContent(event)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No activity yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
