'use client';

import { useAppState } from '@/contexts/app-state';
import { ActivityFeed } from '@/components/activity-feed';
import { AgentEarnings } from '@/components/agent-earnings';
import { PageTransition } from '@/components/page-transition';
import { BlurReveal } from '@/components/ui/blur-reveal';
import { StatCard } from '@/components/stat-card';
import { AnimatedCard, CardBody } from '@/components/ui/animated-card';
import { Radio, Zap, Coins, TrendingUp, Swords } from 'lucide-react';
import Link from 'next/link';
import { GradientSlideButton } from '@/components/ui/gradient-slide-button';

export default function ActivityPage() {
  const { activityEvents, agentEarnings } = useAppState();

  const paymentCount = activityEvents.filter(e => e.type === 'payment' || e.type === 'platform_fee').length;
  const totalVolume = activityEvents
    .filter(e => e.type === 'payment' || e.type === 'platform_fee')
    .reduce((sum, e) => sum + parseFloat((e.data as { amount?: string }).amount || '0'), 0);
  const hasActivity = activityEvents.length > 0;

  return (
    <PageTransition>
      <div className="mb-8">
        <BlurReveal delay={0} className="block">
          <h1 className="text-3xl font-bold text-foreground mb-1 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Radio className="w-6 h-6 text-primary" />
            </div>
            Activity
            {hasActivity && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
            )}
          </h1>
        </BlurReveal>
        <BlurReveal delay={0.1} className="block">
          <p className="text-muted-foreground">
            {hasActivity
              ? 'Real-time payment tracking — all instant, zero gas'
              : 'Start a debate to see real-time payment activity'}
          </p>
        </BlurReveal>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <BlurReveal delay={0.1} className="block">
          <StatCard
            label="Total Payments"
            value={String(paymentCount)}
            icon={<Zap className="w-5 h-5" />}
            highlight={paymentCount > 0}
          />
        </BlurReveal>
        <BlurReveal delay={0.15} className="block">
          <StatCard
            label="Volume"
            value={`${totalVolume.toFixed(2)} USDC`}
            icon={<Coins className="w-5 h-5" />}
          />
        </BlurReveal>
        <BlurReveal delay={0.2} className="block">
          <StatCard
            label="Agents Paid"
            value={String(Object.keys(agentEarnings).length)}
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </BlurReveal>
      </div>

      {/* Main content: earnings sidebar + activity feed */}
      {hasActivity ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BlurReveal delay={0.25} className="block">
              <ActivityFeed events={activityEvents} />
            </BlurReveal>
          </div>
          <div>
            {Object.keys(agentEarnings).length > 0 && (
              <BlurReveal delay={0.3} className="block">
                <AgentEarnings earnings={agentEarnings} />
              </BlurReveal>
            )}
          </div>
        </div>
      ) : (
        <BlurReveal delay={0.25} className="block">
          <AnimatedCard>
            <CardBody className="p-8 text-center items-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Swords className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Activity Yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">Start a debate to see real-time payments flow between AI agents.</p>
              <Link href="/debate">
                <GradientSlideButton colorFrom="#8B5CF6" colorTo="#EC4899" className="rounded-lg">
                  <span className="inline-flex items-center gap-1.5"><Swords className="w-4 h-4 shrink-0" /> Start a Debate</span>
                </GradientSlideButton>
              </Link>
            </CardBody>
          </AnimatedCard>
        </BlurReveal>
      )}
    </PageTransition>
  );
}
