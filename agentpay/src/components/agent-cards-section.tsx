/**
 * Agent Cards Section Component
 * 
 * Displays all debate agents resolved from ENS registry on Sepolia.
 * Highlights the active agent with a BorderBeam glow during debates.
 */

'use client';

import { AgentCard } from './agent-card';
import { useEnsAgentRegistry } from '@/hooks/use-ens-agent-registry';
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
      <h3 className="text-sm font-medium text-gray-700 mb-3">Debate Agents</h3>
      <div className="space-y-2">
        {debateAgents.map((agent) => (
          <AgentCard
            key={agent.ensName}
            agent={agent}
            isLoading={isLoading}
            isActive={activeAgent === agent.agentType}
          />
        ))}
      </div>
    </div>
  );
}
