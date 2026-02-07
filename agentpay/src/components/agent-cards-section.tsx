/**
 * Agent Cards Section Component
 * 
 * Displays all debate agents resolved from ENS registry on Sepolia.
 * Highlights the active agent with a BorderBeam glow during debates.
 * Uses responsive grid and AnimatedList for smooth entry animations.
 */

'use client';

import { AgentCard } from './agent-card';
import { useEnsAgentRegistry } from '@/hooks/use-ens-agent-registry';
import { AnimatedList } from '@/components/ui/animated-list';
import { BlurReveal } from '@/components/ui/blur-reveal';
import type { DebateAgentType } from '@/lib/yellow';

interface AgentCardsSectionProps {
  activeAgent?: DebateAgentType | null;
}

export function AgentCardsSection({ activeAgent }: AgentCardsSectionProps) {
  const { agents, isLoading } = useEnsAgentRegistry();

  // Filter out platform agent for display (only show debate agents)
  const debateAgents = agents.filter(a => a.agentType !== 'platform');

  return (
    <div>
      <BlurReveal delay={0.2}>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Debate Agents</h3>
      </BlurReveal>
      <AnimatedList className="flex flex-wrap justify-center gap-5">
        {debateAgents.map((agent) => (
          <AgentCard
            key={agent.ensName}
            agent={agent}
            isLoading={isLoading}
            isActive={activeAgent === agent.agentType}
          />
        ))}
      </AnimatedList>
    </div>
  );
}
