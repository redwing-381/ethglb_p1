/**
 * Agent Cards Section Component
 * 
 * Displays all three AI agents with their information
 */

'use client';

import { AgentCard } from './agent-card';
import { getAllAgents } from '@/lib/agent-registry';

export function AgentCardsSection() {
  const agents = getAllAgents();

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">Available Agents</h3>
      <div className="space-y-2">
        {agents.map((agent) => (
          <AgentCard
            key={agent.address}
            address={agent.address}
            name={agent.name}
            description={agent.description}
            icon={agent.icon}
          />
        ))}
      </div>
    </div>
  );
}
