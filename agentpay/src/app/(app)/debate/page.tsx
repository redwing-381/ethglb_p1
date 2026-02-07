'use client';

import { useAppState } from '@/contexts/app-state';
import { DebateInput } from '@/components/debate-input';
import { DebateProgress } from '@/components/debate-progress';
import { DebateResults } from '@/components/debate-results';
import { PageTransition } from '@/components/page-transition';
import { BlurReveal } from '@/components/ui/blur-reveal';
import { GlowingButton } from '@/components/ui/glowing-button';
import { AnimatedCard, CardBody } from '@/components/ui/animated-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { GradientSlideButton } from '@/components/ui/gradient-slide-button';
import Link from 'next/link';
import { Swords, Zap, Users, Shield, Scale } from 'lucide-react';

export default function DebatePage() {
  const {
    session, isProcessing, handleDebateSubmit,
    debateResult, costBreakdown, debateError,
    currentRound, activeAgent,
  } = useAppState();

  const isActive = session.status === 'active';

  return (
    <PageTransition>
      <div className="mb-8">
        <BlurReveal delay={0} className="block">
          <h1 className="text-3xl font-bold text-foreground mb-1 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Swords className="w-6 h-6 text-primary" />
            </div>
            Debate Arena
          </h1>
        </BlurReveal>
        <BlurReveal delay={0.1} className="block">
          <p className="text-muted-foreground">AI agents debate any topic — instant payments per round, zero gas</p>
        </BlurReveal>
      </div>

      {!isActive ? (
        <BlurReveal delay={0.15}>
          <AnimatedCard className="p-8 text-center">
            <CardBody className="items-center py-12">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Swords className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Active Session</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">Create a session on the dashboard to fund your first AI debate.</p>
              <Link href="/dashboard">
                <GradientSlideButton colorFrom="#8B5CF6" colorTo="#10B981" className="rounded-lg">
                  <span className="inline-flex items-center gap-1.5"><Zap className="w-4 h-4 shrink-0" /> Go to Dashboard</span>
                </GradientSlideButton>
              </Link>
            </CardBody>
          </AnimatedCard>
        </BlurReveal>
      ) : (
        <div className="space-y-6">
          <BlurReveal delay={0.15}>
            <DebateInput
              isSessionActive={isActive && !isProcessing}
              onSubmit={handleDebateSubmit}
            />
          </BlurReveal>

          <DebateProgress
            currentRound={currentRound}
            totalRounds={3}
            activeAgent={activeAgent}
            isActive={isProcessing}
          />

          <BlurReveal delay={0.2}>
            <DebateResults
              debate={debateResult}
              costBreakdown={costBreakdown}
              isLoading={isProcessing}
              error={debateError}
            />
          </BlurReveal>

          {/* How it works section when no debate is running */}
          {!isProcessing && !debateResult && (
            <BlurReveal delay={0.25}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <AnimatedCard className="relative overflow-hidden">
                  <BorderBeam lightColor="#3B82F6" lightWidth={150} duration={8} borderWidth={1} />
                  <CardBody className="p-5 text-center">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 w-fit mx-auto mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">5 AI Agents</p>
                    <p className="text-xs text-muted-foreground">Debaters, fact-checker, judge, and summarizer collaborate</p>
                  </CardBody>
                </AnimatedCard>
                <AnimatedCard className="relative overflow-hidden">
                  <BorderBeam lightColor="#10B981" lightWidth={150} duration={10} borderWidth={1} />
                  <CardBody className="p-5 text-center">
                    <div className="p-2 rounded-lg bg-green-500/10 text-green-400 w-fit mx-auto mb-3">
                      <Zap className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Instant Payments</p>
                    <p className="text-xs text-muted-foreground">Each agent gets paid per round via Yellow state channels</p>
                  </CardBody>
                </AnimatedCard>
                <AnimatedCard className="relative overflow-hidden">
                  <BorderBeam lightColor="#F59E0B" lightWidth={150} duration={12} borderWidth={1} />
                  <CardBody className="p-5 text-center">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 w-fit mx-auto mb-3">
                      <Scale className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Fair Judging</p>
                    <p className="text-xs text-muted-foreground">Independent judge scores each round with fact-checking</p>
                  </CardBody>
                </AnimatedCard>
              </div>
            </BlurReveal>
          )}
        </div>
      )}
    </PageTransition>
  );
}
