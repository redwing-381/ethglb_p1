'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfettiButton } from '@/components/ui/confetti-button';
import { formatUSDC } from '@/lib/utils';
import type { DebateTranscript, DebateCostBreakdown, FactCheckResult } from '@/types';

interface DebateResultsProps {
  debate: DebateTranscript | null;
  costBreakdown: DebateCostBreakdown | null;
  isLoading: boolean;
  error: string | null;
}

function FactCheckDisplay({ result }: { result: FactCheckResult }) {
  const verdictIcon: Record<string, string> = {
    accurate: '✅', misleading: '⚠️', false: '❌', unverifiable: '❓',
  };
  return (
    <div className="space-y-1">
      {result.claims.map((c, i) => (
        <div key={i} className="flex items-start gap-1.5 text-xs">
          <span>{verdictIcon[c.verdict] || '❓'}</span>
          <div>
            <span className="text-gray-700">"{c.claim}"</span>
            <span className="text-gray-400 ml-1">— {c.source === 'debater_a' ? '🔵' : '🔴'} {c.explanation}</span>
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-500 italic">{result.overallAssessment}</p>
    </div>
  );
}

export function DebateResults({ debate, costBreakdown, isLoading, error }: DebateResultsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">⚡ Debate in Progress...</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 py-6">
            <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-900 rounded-full" />
            <p className="text-sm text-gray-600">AI agents are debating...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader><CardTitle className="text-base text-red-900">Error</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-red-700">{error}</p></CardContent>
      </Card>
    );
  }

  if (!debate) return null;

  const winnerLabel = debate.winner === 'pro' ? '🔵 Pro Wins' : debate.winner === 'con' ? '🔴 Con Wins' : '🤝 Tie';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Debate Results</CardTitle>
          <span className="text-sm font-semibold">{winnerLabel}</span>
        </div>
        <p className="text-xs text-gray-500">Topic: {debate.topic} • {debate.totalRounds} rounds</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Celebration */}
        <div className="flex justify-center">
          <ConfettiButton
            className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
            particleCount={100}
            spread={90}
          >
            🎉 Debate Complete!
          </ConfettiButton>
        </div>
        {/* Rounds */}
        {debate.rounds.map((round) => (
          <div key={round.number} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-gray-500">Round {round.number}</div>

            <div className="space-y-1.5">
              <div className="bg-blue-50 rounded p-2">
                <div className="text-xs font-medium text-blue-700 mb-1">🔵 Debater A (Pro)</div>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{round.proArgument}</p>
              </div>
              <div className="bg-red-50 rounded p-2">
                <div className="text-xs font-medium text-red-700 mb-1">🔴 Debater B (Con)</div>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{round.conArgument}</p>
              </div>
            </div>

            {/* Fact Check */}
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs font-medium text-gray-700 mb-1">🔍 Fact Check</div>
              <FactCheckDisplay result={round.factCheck} />
            </div>

            {/* Score */}
            <div className="flex items-center gap-3 text-xs">
              <span className="font-medium text-gray-600">⚖️ Score:</span>
              <span className="text-blue-600">Pro {round.score.proScore}/10</span>
              <span className="text-red-600">Con {round.score.conScore}/10</span>
              <span className="text-gray-400">— {round.score.reasoning}</span>
            </div>
          </div>
        ))}

        {/* Verdict */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-yellow-800 mb-1">⚖️ Final Verdict</div>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{debate.verdict}</p>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-gray-700 mb-1">📝 Summary</div>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{debate.summary}</p>
        </div>

        {/* Cost Breakdown */}
        {costBreakdown && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-gray-700">Cost Breakdown</div>
            {costBreakdown.agentCosts.map((cost, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-600">{cost.agentName} ({cost.label})</span>
                <span className="text-gray-900">{formatUSDC(cost.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs border-t border-gray-200 pt-1">
              <span className="text-purple-600">Platform Fee ({costBreakdown.platformFeePercentage}%)</span>
              <span className="text-purple-700">{formatUSDC(costBreakdown.platformFee)}</span>
            </div>
            <div className="flex justify-between text-xs font-medium border-t border-gray-300 pt-1">
              <span>Total</span>
              <span className="text-green-700">{formatUSDC(costBreakdown.totalCost)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
