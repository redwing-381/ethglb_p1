'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
          <CardTitle className="text-lg">Result</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            <p className="text-gray-600">Agents are working on your task...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-lg text-red-700">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Result</CardTitle>
          <div className="text-sm text-gray-500">
            Cost: <span className="font-medium text-green-600">{result.totalCost} USDC</span>
            {' • '}
            {result.subTaskCount} sub-tasks
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agents used */}
        <div className="flex flex-wrap gap-2">
          {result.agentsUsed.map((agent) => (
            <span 
              key={agent} 
              className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
            >
              {agent}
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
            {result.content}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
