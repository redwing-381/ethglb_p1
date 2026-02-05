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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Available Agents
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Specialized AI agents ready to work on your tasks
          </p>
        </div>
        <div className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
          {agents.length} Active
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
