'use client';

import { ConfettiButton } from '@/components/ui/confetti-button';
import { BorderBeam } from '@/components/ui/border-beam';
import { formatUSDC } from '@/lib/utils';
import type { DebateTranscript, DebateCostBreakdown, FactCheckResult } from '@/types';
import {
  CheckCircle2, AlertTriangle, XCircle, HelpCircle, Search,
  Scale, FileText, PartyPopper, Zap, Trophy, ThumbsUp, ThumbsDown, Minus
} from 'lucide-react';

/** Strip markdown bold/italic/headers from AI output for clean display */
function cleanMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, (m) => m)
    .trim();
}

interface DebateResultsProps {
  debate: DebateTranscript | null;
  costBreakdown: DebateCostBreakdown | null;
  isLoading: boolean;
  error: string | null;
}

function FactCheckDisplay({ result }: { result: FactCheckResult }) {
  const verdictConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    accurate: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-green-500', label: 'Accurate' },
    misleading: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-yellow-500', label: 'Misleading' },
    false: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-red-500', label: 'False' },
    unverifiable: { icon: <HelpCircle className="w-3.5 h-3.5" />, color: 'text-muted-foreground', label: 'Unverifiable' },
  };

  return (
    <div className="space-y-2">
      {result.claims.map((c, i) => {
        const config = verdictConfig[c.verdict] || verdictConfig.unverifiable;
        const sourceLabel = c.source === 'debater_a' ? 'Pro' : 'Con';
        const sourceColor = c.source === 'debater_a' ? 'text-blue-400' : 'text-red-400';
        return (
          <div key={i} className="flex items-start gap-2 text-xs p-2 bg-secondary/30 rounded-md">
            <span className={`flex-shrink-0 mt-0.5 ${config.color}`}>{config.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`font-medium ${config.color}`}>{config.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-secondary ${sourceColor}`}>{sourceLabel}</span>
              </div>
              <p className="text-foreground/80 leading-relaxed">{c.claim}</p>
              <p className="text-muted-foreground mt-0.5">{c.explanation}</p>
            </div>
          </div>
        );
      })}
      {result.overallAssessment && (
        <p className="text-xs text-muted-foreground italic pt-1 border-t border-border/50">{result.overallAssessment}</p>
      )}
    </div>
  );
}

export function DebateResults({ debate, costBreakdown, isLoading, error }: DebateResultsProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <h3 className="text-base font-semibold flex items-center gap-1.5 mb-4">
          <Zap className="w-4 h-4 text-primary" /> Debate in Progress...
        </h3>
        <div className="flex items-center gap-3 py-6">
          <div className="animate-spin h-5 w-5 border-2 border-border border-t-foreground rounded-full" />
          <p className="text-sm text-muted-foreground">AI agents are debating...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 shadow-sm p-6">
        <h3 className="text-base font-semibold text-destructive mb-2">Error</h3>
        <p className="text-sm text-destructive/80">{error}</p>
      </div>
    );
  }

  if (!debate) return null;

  const winnerLabel = debate.winner === 'pro' ? 'Pro Wins' : debate.winner === 'con' ? 'Con Wins' : 'Tie';
  const winnerColor = debate.winner === 'pro' ? '#3B82F6' : debate.winner === 'con' ? '#EF4444' : '#F59E0B';
  const WinnerIcon = debate.winner === 'pro' ? ThumbsUp : debate.winner === 'con' ? ThumbsDown : Minus;

  const totalPro = debate.rounds.reduce((s, r) => s + r.score.proScore, 0);
  const totalCon = debate.rounds.reduce((s, r) => s + r.score.conScore, 0);

  return (
    <div className="relative rounded-xl border border-border bg-card shadow-sm">
      <BorderBeam lightColor={winnerColor} lightWidth={300} duration={5} borderWidth={2} />

      {/* Sticky header */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> Debate Results
          </h3>
          <span className={`text-sm font-semibold flex items-center gap-1.5 px-3 py-1 rounded-full ${
            debate.winner === 'pro' ? 'bg-blue-500/10 text-blue-500' : debate.winner === 'con' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
          }`}>
            <WinnerIcon className="w-3.5 h-3.5" /> {winnerLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Topic: {debate.topic}</p>
      </div>

      {/* Scrollable content */}
      <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto space-y-5">
        {/* Score overview */}
        <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-1">Pro (Debater A)</p>
            <p className="text-2xl font-bold text-blue-500">{totalPro}</p>
          </div>
          <div className="text-center px-4">
            <p className="text-xs text-muted-foreground mb-1">Rounds</p>
            <p className="text-2xl font-bold text-foreground">{debate.totalRounds}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-1">Con (Debater B)</p>
            <p className="text-2xl font-bold text-red-500">{totalCon}</p>
          </div>
        </div>

        <div className="flex justify-center">
          <ConfettiButton
            className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
            particleCount={100} spread={90}>
            <PartyPopper className="w-4 h-4 mr-1.5" /> Debate Complete!
          </ConfettiButton>
        </div>

        {/* Rounds */}
        {debate.rounds.map((round) => (
          <div key={round.number} className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-secondary/50 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Round {round.number}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-blue-500 font-medium">Pro: {round.score.proScore}/10</span>
                <span className="text-red-500 font-medium">Con: {round.score.conScore}/10</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold text-blue-400">Debater A (Pro)</span>
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{cleanMarkdown(round.proArgument)}</p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs font-semibold text-red-400">Debater B (Con)</span>
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{cleanMarkdown(round.conArgument)}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">Fact Check</span>
                </div>
                <FactCheckDisplay result={round.factCheck} />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
                <Scale className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">{round.score.reasoning}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Verdict */}
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-500">Final Verdict</span>
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{cleanMarkdown(debate.verdict)}</p>
        </div>

        {/* Summary */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground/70">Summary</span>
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{cleanMarkdown(debate.summary)}</p>
        </div>

        {/* Cost breakdown */}
        {costBreakdown && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
            <div className="text-sm font-semibold text-foreground/70 mb-3">Cost Breakdown</div>
            {costBreakdown.agentCosts.map((cost, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{cost.agentName}</span>
                <span className="text-foreground font-medium tabular-nums">{formatUSDC(cost.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
              <span className="text-purple-400">Platform Fee ({costBreakdown.platformFeePercentage}%)</span>
              <span className="text-purple-400 font-medium tabular-nums">{formatUSDC(costBreakdown.platformFee)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
              <span className="text-foreground">Total</span>
              <span className="text-green-500 tabular-nums">{formatUSDC(costBreakdown.totalCost)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
