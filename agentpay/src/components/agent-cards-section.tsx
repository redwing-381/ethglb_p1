/**
 * Agent Cards Section Component
 * 
 * Displays all six debate agents with their information and pricing
 */

'use client';

import { AgentCard } from './agent-card';
import { getAllAgents } from '@/lib/ai';
import { DEBATE_PRICING } from '@/lib/debate';
import type { DebateAgentType } from '@/types';

const NAME_TO_TYPE: Record<string, DebateAgentType> = {
  'Moderator': 'moderator',
  'Debater A': 'debater_a',
  'Debater B': 'debater_b',
  'Fact Checker': 'fact_checker',
  'Judge': 'judge',
  'Summarizer': 'summarizer',
};

export function AgentCardsSection() {
  const agents = getAllAgents();

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">Debate Agents</h3>
      <div className="space-y-2">
        {agents.map((agent) => {
          const agentType = NAME_TO_TYPE[agent.name];
          const pricing = agentType ? DEBATE_PRICING[agentType] : null;
          return (
            <AgentCard
              key={agent.address}
              address={agent.address}
              name={agent.name}
              description={agent.description}
              icon={agent.icon}
              basePrice={pricing?.basePrice}
            />
          );
        })}
      </div>
    </div>
  );
}
