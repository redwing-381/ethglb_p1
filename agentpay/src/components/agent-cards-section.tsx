/**
 * Agent Cards Section Component
 * 
 * Displays all three AI agents with their information and pricing
 */

'use client';

import { AgentCard } from './agent-card';
import { getAllAgents, AGENT_CONFIGS } from '@/lib/ai';
import type { AgentType } from '@/lib/ai';

export function AgentCardsSection() {
  const agents = getAllAgents();

  // Map agent names to types for pricing lookup
  const nameToType: Record<string, AgentType> = {
    'Orchestrator': 'orchestrator',
    'Researcher': 'researcher',
    'Writer': 'writer',
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">Available Agents</h3>
      <div className="space-y-2">
        {agents.map((agent) => {
          const agentType = nameToType[agent.name];
          const config = agentType ? AGENT_CONFIGS[agentType] : null;
          const basePrice = config?.pricing?.basePrice;
          
          return (
            <AgentCard
              key={agent.address}
              address={agent.address}
              name={agent.name}
              description={agent.description}
              icon={agent.icon}
              basePrice={basePrice}
            />
          );
        })}
      </div>
    </div>
  );
}
