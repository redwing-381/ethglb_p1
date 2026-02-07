'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedCard } from '@/components/ui/animated-card';
import { ConfettiButton } from '@/components/ui/confetti-button';
import { BorderBeam } from '@/components/ui/border-beam';
import { formatUSDC } from '@/lib/utils';
import type { DebateTranscript, DebateCostBreakdown, FactCheckResult } from '@/types';
import {
  CheckCircle2, AlertTriangle, XCircle, HelpCircle, Search,
  Scale, FileText, PartyPopper, Zap, CircleDot
} from 'lucide-react';

interface DebateResultsProps {
  debate: DebateTranscript | null;
  costBreakdown: DebateCostBreakdown | null;
  isLoading: boolean;
  error: string | null;
}

function FactCheckDisplay({ result }: { result: FactCheckResult }) {
  const verdictIcon: Record<string, React.ReactNode> = {
    accurate: <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />,
    misleading: <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />,
    false: <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />,
    unverifiable: <HelpCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />,
  };
  return (
    <div className="space-y-1">
      {result.claims.map((c, i) => (
        <div key={i} className="flex items-start gap-1.5 text-xs">
          {verdictIcon[c.verdict] || <HelpCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
          <div>
            <span className="text-foreground/80">&quot;{c.claim}&quot;</span>
            <span className="text-muted-foreground ml-1">
              — <CircleDot className={`w-2.5 h-2.5 inline ${c.source === 'debater_a' ? 'text-blue-500' : 'text-red-500'}`} /> {c.explanation}
            </span>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground italic">{result.overallAssessment}</p>
    </div>
  );
}

export function DebateResults({ debate, costBreakdown, isLoading, error }: DebateResultsProps) {
  if (isLoading) {
    return (
      <AnimatedCard>
        <Card className="border-0 shadow-none">
          <CardHeader><CardTitle className="text-base flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-primary" /> Debate in Progress...
          </CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 py-6">
              <div className="animate-spin h-5 w-5 border-2 border-border border-t-foreground rounded-full" />
              <p className="text-sm text-muted-foreground">AI agents are debating...</p>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>
    );
  }

  if (error) {
    return (
      <AnimatedCard>
        <Card className="border-red-200 bg-red-50 border-0 shadow-none">
          <CardHeader><CardTitle className="text-base text-red-900">Error</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-red-700">{error}</p></CardContent>
        </Card>
      </AnimatedCard>
    );
  }

  if (!debate) return null;

  const winnerLabel = debate.winner === 'pro'
    ? 'Pro Wins' : debate.winner === 'con' ? 'Con Wins' : 'Tie';
  const winnerColor = debate.winner === 'pro'
    ? '#3B82F6' : debate.winner === 'con' ? '#EF4444' : '#F59E0B';

  return (
    <AnimatedCard className="relative overflow-hidden">
      <BorderBeam lightColor={winnerColor} lightWidth={300} duration={5} borderWidth={2} />
      <Card className="border-0 shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Debate Results</CardTitle>
          <span className={`text-sm font-semibold flex items-center gap-1 ${
            debate.winner === 'pro' ? 'text-blue-600' : debate.winner === 'con' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            <CircleDot className="w-3.5 h-3.5" /> {winnerLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Topic: {debate.topic} · {debate.totalRounds} rounds</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <ConfettiButton
            className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
            particleCount={100} spread={90}>
            <PartyPopper className="w-4 h-4 mr-1.5" /> Debate Complete!
          </ConfettiButton>
        </div>

        {debate.rounds.map((round) => (
          <div key={round.number} className="border border-border rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Round {round.number}</div>
            <div className="space-y-1.5">
              <div className="bg-blue-500/10 rounded p-2">
                <div className="text-xs font-medium text-blue-400 mb-1 flex items-center gap-1">
                  <CircleDot className="w-3 h-3 text-blue-400" /> Debater A (Pro)
                </div>
                <p className="text-xs text-foreground/80 whitespace-pre-wrap">{round.proArgument}</p>
              </div>
              <div className="bg-red-500/10 rounded p-2">
                <div className="text-xs font-medium text-red-400 mb-1 flex items-center gap-1">
                  <CircleDot className="w-3 h-3 text-red-400" /> Debater B (Con)
                </div>
                <p className="text-xs text-foreground/80 whitespace-pre-wrap">{round.conArgument}</p>
              </div>
            </div>
            <div className="bg-secondary/50 rounded p-2">
              <div className="text-xs font-medium text-foreground/70 mb-1 flex items-center gap-1">
                <Search className="w-3 h-3" /> Fact Check
              </div>
              <FactCheckDisplay result={round.factCheck} />
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-medium text-muted-foreground flex items-center gap-1">
                <Scale className="w-3 h-3" /> Score:
              </span>
              <span className="text-blue-600">Pro {round.score.proScore}/10</span>
              <span className="text-red-600">Con {round.score.conScore}/10</span>
              <span className="text-muted-foreground">— {round.score.reasoning}</span>
            </div>
          </div>
        ))}

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <div className="text-xs font-semibold text-yellow-400 mb-1 flex items-center gap-1">
            <Scale className="w-3.5 h-3.5" /> Final Verdict
          </div>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{debate.verdict}</p>
        </div>

        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="text-xs font-semibold text-foreground/70 mb-1 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Summary
          </div>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{debate.summary}</p>
        </div>

        {costBreakdown && (
          <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-foreground/70">Cost Breakdown</div>
            {costBreakdown.agentCosts.map((cost, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{cost.agentName} ({cost.label})</span>
                <span className="text-foreground">{formatUSDC(cost.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs border-t border-border pt-1">
              <span className="text-purple-600">Platform Fee ({costBreakdown.platformFeePercentage}%)</span>
              <span className="text-purple-700">{formatUSDC(costBreakdown.platformFee)}</span>
            </div>
            <div className="flex justify-between text-xs font-medium border-t border-border pt-1">
              <span>Total</span>
              <span className="text-green-700">{formatUSDC(costBreakdown.totalCost)}</span>
            </div>
          </div>
        )}
      </CardContent>
      </Card>
    </AnimatedCard>
  );
}
