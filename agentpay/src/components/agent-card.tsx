/**
 * Agent Card Component
 * 
 * Displays agent information with ENS subname, model, and pricing.
 * Uses AnimatedCard wrapper with BorderBeam glow when agent is active.
 */

'use client';

import { AnimatedCard, CardBody } from '@/components/ui/animated-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { EnsBadge } from '@/components/ens-badge';
import { AgentAvatar } from '@/components/agent-avatar';
import { formatUSDC } from '@/lib/utils';
import type { EnsAgentConfig } from '@/types';

interface AgentCardProps {
  agent: EnsAgentConfig;
  isLoading?: boolean;
  isActive?: boolean;
}

/** Color map for each agent role */
const AGENT_COLORS: Record<string, string> = {
  moderator: '#8B5CF6',
  debater_a: '#3B82F6',
  debater_b: '#EF4444',
  fact_checker: '#F59E0B',
  judge: '#10B981',
  summarizer: '#EC4899',
};

export function AgentCard({ agent, isLoading, isActive }: AgentCardProps) {
  const isFree = parseFloat(agent.basePrice) === 0;
  const agentColor = AGENT_COLORS[agent.agentType] || '#8B5CF6';

  if (isLoading) {
    return (
      <AnimatedCard className="w-full">
        <CardBody>
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-100 rounded w-40" />
            </div>
          </div>
        </CardBody>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard className={`w-full transition-all duration-300 ${isActive ? 'scale-[1.02] shadow-md' : 'hover:shadow-sm'}`}>
      {isActive && (
        <BorderBeam
          lightColor={agentColor}
          lightWidth={250}
          duration={4}
          borderWidth={2}
        />
      )}
      <CardBody className="p-3">
        <div className="flex items-center gap-3">
          <AgentAvatar avatar={agent.avatar} icon={agent.icon} name={agent.name} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm text-gray-900">{agent.name}</h4>
                {agent.isEnsResolved && <EnsBadge />}
              </div>
              <span className={`text-xs font-medium ${isFree ? 'text-green-600' : 'text-gray-600'}`}>
                {isFree ? 'Free' : formatUSDC(agent.basePrice)}
                {agent.isEnsResolved && <span className="text-blue-400 ml-1" title="Price from ENS text record">⛓</span>}
              </span>
            </div>
            <p className="text-xs text-blue-600 font-mono truncate">{agent.ensName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{agent.description}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {agent.model !== 'n/a' && (
                <p className="text-xs text-gray-400">Model: {agent.model}</p>
              )}
              {agent.isEnsResolved && (
                <span className="text-xs text-blue-400" title="All metadata resolved from ENS text records on Sepolia">⛓ on-chain</span>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </AnimatedCard>
  );
}
