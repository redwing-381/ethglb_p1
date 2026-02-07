'use client';

import { useAppState } from '@/contexts/app-state';
import { AgentCardsSection } from '@/components/agent-cards-section';
import { PageTransition } from '@/components/page-transition';
import { BlurReveal } from '@/components/ui/blur-reveal';
import { AnimatedCard, CardBody, CardTitle, CardDescription, CardVisual } from '@/components/ui/animated-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { Visual2 } from '@/components/ui/visual-2';
import { Bot } from 'lucide-react';

export default function AgentsPage() {
  const { activeAgent } = useAppState();

  return (
    <PageTransition>
      <div className="mb-8">
        <BlurReveal delay={0} className="block">
          <h1 className="text-3xl font-bold text-foreground mb-1 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            AI Agents
          </h1>
        </BlurReveal>
        <BlurReveal delay={0.1} className="block">
          <p className="text-muted-foreground">ENS-registered debate agents on Sepolia — identities resolved on-chain</p>
        </BlurReveal>
      </div>

      {/* Animated info cards */}
      <BlurReveal delay={0.15}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <AnimatedCard className="relative overflow-hidden">
            <BorderBeam lightColor="#3b82f6" lightWidth={150} duration={8} borderWidth={1} />
            <CardVisual>
              <Visual2 mainColor="#3b82f6" secondaryColor="#60a5fa" overlayTitle="ENS Resolution" overlayDescription="On-chain identity via *.agentpay.eth subnames" techTags={["ENS", "Subnames", "Sepolia", "Resolver", "Records", "L2"]} />
            </CardVisual>
            <CardBody>
              <CardTitle className="text-sm">ENS Subnames</CardTitle>
              <CardDescription className="text-xs">*.agentpay.eth identities resolved on Sepolia</CardDescription>
            </CardBody>
          </AnimatedCard>
          <AnimatedCard className="relative overflow-hidden">
            <BorderBeam lightColor="#10b981" lightWidth={150} duration={10} borderWidth={1} />
            <CardVisual>
              <Visual2 mainColor="#10b981" secondaryColor="#34d399" overlayTitle="State Channels" overlayDescription="Off-chain transfers with zero gas fees" techTags={["Yellow", "Nitrolite", "Clearnode", "WebSocket", "EIP-712", "Custody"]} />
            </CardVisual>
            <CardBody>
              <CardTitle className="text-sm">Gasless Payments</CardTitle>
              <CardDescription className="text-xs">Instant transfers via Yellow state channels</CardDescription>
            </CardBody>
          </AnimatedCard>
          <AnimatedCard className="relative overflow-hidden">
            <BorderBeam lightColor="#8b5cf6" lightWidth={150} duration={12} borderWidth={1} />
            <CardVisual>
              <Visual2 mainColor="#8b5cf6" secondaryColor="#a78bfa" overlayTitle="Text Records" overlayDescription="Agent roles, models, and pricing stored on-chain" techTags={["wagmi", "viem", "OpenRouter", "Claude", "GPT-4", "AI SDK"]} />
            </CardVisual>
            <CardBody>
              <CardTitle className="text-sm">On-Chain Metadata</CardTitle>
              <CardDescription className="text-xs">Roles, models, and prices from ENS text records</CardDescription>
            </CardBody>
          </AnimatedCard>
        </div>
      </BlurReveal>

      <BlurReveal delay={0.2}>
        <AgentCardsSection activeAgent={activeAgent} />
      </BlurReveal>
    </PageTransition>
  );
}
