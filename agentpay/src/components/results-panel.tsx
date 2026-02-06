'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatUSDC } from '@/lib/utils';

interface TaskResult {
  content: string;
  totalCost: string;
  agentsUsed: string[];
  subTaskCount: number;
}

interface ResultsPanelProps {
  result: TaskResult | null;
  isLoading: boolean;
  error: string | null;
}

export function ResultsPanel({ result, isLoading, error }: ResultsPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Working...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 py-6">
            <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-900 rounded-full" />
            <p className="text-sm text-gray-600">Agents are processing your task</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-red-900">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Result</CardTitle>
          <div className="text-xs text-gray-500">
            {formatUSDC(result.totalCost)} • {result.subTaskCount} tasks
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {result.agentsUsed.map((agent) => (
            <span 
              key={agent} 
              className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
            >
              {agent}
            </span>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans leading-relaxed">
            {result.content}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
