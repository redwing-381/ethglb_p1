'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatUSDC } from '@/lib/format';

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
      <Card className="border-gray-200">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-lg text-gray-900">Result</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative">
              <div className="animate-spin h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-6 w-6 bg-white rounded-full" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-900 font-medium mb-1">Agents are working on your task</p>
              <p className="text-sm text-gray-500">This may take a few moments...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="border-b border-red-200">
          <CardTitle className="text-lg text-red-700 flex items-center gap-2">
            <span>❌</span>
            <span>Error</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-red-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <Card className="border-gray-200 animate-fade-in">
      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
            <span>✅</span>
            <span>Result</span>
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">
              Cost: <span className="font-semibold text-green-600">{formatUSDC(result.totalCost)}</span>
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">
              {result.subTaskCount} sub-tasks
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {/* Agents used */}
        <div className="flex flex-wrap gap-2">
          {result.agentsUsed.map((agent) => (
            <span 
              key={agent} 
              className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100"
            >
              {agent}
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 max-h-96 overflow-y-auto border border-gray-100">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
            {result.content}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
