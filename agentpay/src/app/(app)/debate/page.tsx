'use client';

import { useAppState } from '@/contexts/app-state';
import { DebateInput } from '@/components/debate-input';
import { DebateProgress } from '@/components/debate-progress';
import { DebateResults } from '@/components/debate-results';
import { PageTransition } from '@/components/page-transition';
import { BlurReveal } from '@/components/ui/blur-reveal';
import { AnimatedCard, CardBody, CardTitle, CardDescription, CardVisual } from '@/components/ui/animated-card';
import { Visual1 } from '@/components/ui/visual-1';
import { GradientSlideButton } from '@/components/ui/gradient-slide-button';
import Link from 'next/link';
import { Swords, Zap, Scale } from 'lucide-react';

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
        <div className="space-y-6">
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

          <BlurReveal delay={0.25}>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" /> How It Works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <AnimatedCard>
                <CardVisual>
                  <Visual1
                    mainColor="#3B82F6"
                    secondaryColor="#60A5FA"
                    overlayTitle="6 AI Agents"
                    overlayDescription="Debaters, fact-checker, judge, moderator, and summarizer"
                    badges={[{ label: "Pro", color: "#3B82F6" }, { label: "Con", color: "#EF4444" }]}
                  />
                </CardVisual>
                <CardBody>
                  <CardTitle>Multi-Agent Debate</CardTitle>
                  <CardDescription>6 specialized agents collaborate across 3 rounds</CardDescription>
                </CardBody>
              </AnimatedCard>
              <AnimatedCard>
                <CardVisual>
                  <Visual1
                    mainColor="#10B981"
                    secondaryColor="#34D399"
                    overlayTitle="Zero Gas Fees"
                    overlayDescription="Payments flow through Yellow state channels"
                    badges={[{ label: "Instant", color: "#10B981" }, { label: "Gasless", color: "#34D399" }]}
                  />
                </CardVisual>
                <CardBody>
                  <CardTitle>Instant Payments</CardTitle>
                  <CardDescription>Each agent gets paid per round via Yellow Network</CardDescription>
                </CardBody>
              </AnimatedCard>
              <AnimatedCard>
                <CardVisual>
                  <Visual1
                    mainColor="#F59E0B"
                    secondaryColor="#FBBF24"
                    overlayTitle="Objective Scoring"
                    overlayDescription="Independent judge with fact-checking verification"
                    badges={[{ label: "Score", color: "#F59E0B" }, { label: "Facts", color: "#EF4444" }]}
                  />
                </CardVisual>
                <CardBody>
                  <CardTitle>Fair Judging</CardTitle>
                  <CardDescription>Independent judge scores each round with fact-checking</CardDescription>
                </CardBody>
              </AnimatedCard>
            </div>
          </BlurReveal>
        </div>
      ) : (
        <div className="space-y-6">
          {(isProcessing || debateResult) ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BlurReveal delay={0.15}>
                <DebateInput
                  isSessionActive={isActive && !isProcessing}
                  onSubmit={handleDebateSubmit}
                />
              </BlurReveal>

              <BlurReveal delay={0.2}>
                <DebateResults
                  debate={debateResult}
                  costBreakdown={costBreakdown}
                  isLoading={isProcessing}
                  error={debateError}
                />
              </BlurReveal>
            </div>
          ) : (
            <BlurReveal delay={0.15}>
              <DebateInput
                isSessionActive={isActive && !isProcessing}
                onSubmit={handleDebateSubmit}
              />
            </BlurReveal>
          )}

          <DebateProgress
            currentRound={currentRound}
            totalRounds={3}
            activeAgent={activeAgent}
            isActive={isProcessing}
          />

          {/* How it works section when no debate is running */}
          {!isProcessing && !debateResult && (
            <BlurReveal delay={0.25}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-4">
                <AnimatedCard>
                  <CardVisual>
                    <Visual1
                      mainColor="#3B82F6"
                      secondaryColor="#60A5FA"
                      overlayTitle="6 AI Agents"
                      overlayDescription="Debaters, fact-checker, judge, moderator, and summarizer"
                      badges={[{ label: "Pro", color: "#3B82F6" }, { label: "Con", color: "#EF4444" }]}
                    />
                  </CardVisual>
                  <CardBody>
                    <CardTitle>Multi-Agent Debate</CardTitle>
                    <CardDescription>6 specialized agents collaborate across 3 rounds</CardDescription>
                  </CardBody>
                </AnimatedCard>
                <AnimatedCard>
                  <CardVisual>
                    <Visual1
                      mainColor="#10B981"
                      secondaryColor="#34D399"
                      overlayTitle="Zero Gas Fees"
                      overlayDescription="Payments flow through Yellow state channels"
                      badges={[{ label: "Instant", color: "#10B981" }, { label: "Gasless", color: "#34D399" }]}
                    />
                  </CardVisual>
                  <CardBody>
                    <CardTitle>Instant Payments</CardTitle>
                    <CardDescription>Each agent gets paid per round via Yellow Network</CardDescription>
                  </CardBody>
                </AnimatedCard>
                <AnimatedCard>
                  <CardVisual>
                    <Visual1
                      mainColor="#F59E0B"
                      secondaryColor="#FBBF24"
                      overlayTitle="Objective Scoring"
                      overlayDescription="Independent judge with fact-checking verification"
                      badges={[{ label: "Score", color: "#F59E0B" }, { label: "Facts", color: "#EF4444" }]}
                    />
                  </CardVisual>
                  <CardBody>
                    <CardTitle>Fair Judging</CardTitle>
                    <CardDescription>Independent judge scores each round with fact-checking</CardDescription>
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
