'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DEBATE_AGENT_CONFIGS } from '@/lib/ai';
import type { DebateAgentType } from '@/types';

interface DebateProgressProps {
  currentRound: number;
  totalRounds: number;
  activeAgent: DebateAgentType | null;
  isActive: boolean;
}

export function DebateProgress({ currentRound, totalRounds, activeAgent, isActive }: DebateProgressProps) {
  if (!isActive) return null;

  const config = activeAgent ? DEBATE_AGENT_CONFIGS[activeAgent] : null;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                {currentRound > 0 ? `Round ${currentRound} of ${totalRounds}` : 'Starting debate...'}
              </p>
              {config && (
                <p className="text-xs text-blue-700">
                  {config.icon} {config.name} is working...
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
