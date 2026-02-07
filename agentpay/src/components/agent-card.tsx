/**
 * Agent Card Component
 * 
 * Displays agent information using a FlippingCard with front/back faces.
 * Front: Avatar, name, ENS badge, role icon, ENS subname
 * Back: Description, model info, base price, on-chain metadata, address
 */

'use client';

import { FlippingCard } from '@/components/ui/flipping-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { EnsBadge } from '@/components/ens-badge';
import { AgentAvatar, AgentIcon } from '@/components/agent-avatar';
import { formatUSDC } from '@/lib/utils';
import type { EnsAgentConfig } from '@/types';
import { Link2, Cpu, DollarSign, Fingerprint, Sparkles } from 'lucide-react';

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

const AGENT_GRADIENTS: Record<string, string> = {
  moderator: 'from-violet-500/20 to-purple-500/5',
  debater_a: 'from-blue-500/20 to-cyan-500/5',
  debater_b: 'from-red-500/20 to-orange-500/5',
  fact_checker: 'from-amber-500/20 to-yellow-500/5',
  judge: 'from-emerald-500/20 to-green-500/5',
  summarizer: 'from-pink-500/20 to-rose-500/5',
};

export function AgentCard({ agent, isLoading, isActive }: AgentCardProps) {
  const isFree = parseFloat(agent.basePrice) === 0;
  const agentColor = AGENT_COLORS[agent.agentType] || '#8B5CF6';
  const gradient = AGENT_GRADIENTS[agent.agentType] || 'from-violet-500/20 to-purple-500/5';

  if (isLoading) {
    return (
      <div className="w-[280px] h-[320px] rounded-xl border border-border bg-card animate-pulse">
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="w-14 h-14 bg-muted rounded-full" />
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-3 bg-muted/50 rounded w-32" />
        </div>
      </div>
    );
  }

  const truncatedAddress = `${agent.address.slice(0, 6)}...${agent.address.slice(-4)}`;

  const frontFace = (
    <div className="flex flex-col items-center justify-center h-full px-4 py-6 text-center relative">
      {/* Gradient accent at top */}
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${gradient} rounded-t-xl`} />
      
      {/* Avatar */}
      <div className="relative z-10 mb-3">
        <div
          className="p-1 rounded-full"
          style={{ boxShadow: `0 0 20px ${agentColor}30` }}
        >
          <AgentAvatar avatar={agent.avatar} icon={agent.icon} name={agent.name} size="lg" className="w-14 h-14" />
        </div>
        {isActive && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: agentColor }} />
            <span className="relative inline-flex rounded-full h-4 w-4" style={{ backgroundColor: agentColor }} />
          </span>
        )}
      </div>

      {/* Name + ENS badge */}
      <div className="relative z-10 flex items-center gap-2 mb-1">
        <h4 className="font-semibold text-base text-foreground">{agent.name}</h4>
        {agent.isEnsResolved && <EnsBadge className="text-[10px] px-1.5 py-0" />}
      </div>

      {/* ENS subname */}
      <p className="text-xs text-blue-400 font-mono mb-3">{agent.ensName}</p>

      {/* Role icon + price */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <AgentIcon icon={agent.icon} className="w-3.5 h-3.5" />
          <span className="capitalize">{agent.agentType.replace('_', ' ')}</span>
        </span>
        <span className="w-px h-3 bg-border" />
        <span className={`font-medium ${isFree ? 'text-green-500' : 'text-foreground'}`}>
          {isFree ? 'Free' : formatUSDC(agent.basePrice)}
        </span>
      </div>

      {/* Hover hint */}
      <p className="absolute bottom-3 text-[10px] text-muted-foreground/50">Hover to flip</p>
    </div>
  );

  const backFace = (
    <div className="flex flex-col h-full px-5 py-5 text-left">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <AgentAvatar avatar={agent.avatar} icon={agent.icon} name={agent.name} size="sm" />
        <div>
          <h4 className="font-semibold text-sm text-foreground">{agent.name}</h4>
          <p className="text-[10px] text-blue-400 font-mono">{agent.ensName}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{agent.description}</p>

      {/* Details grid */}
      <div className="space-y-2.5 flex-1">
        {agent.model !== 'n/a' && (
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded bg-purple-500/10">
              <Cpu className="w-3 h-3 text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Model</p>
              <p className="text-xs text-foreground">{agent.model}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-green-500/10">
            <DollarSign className="w-3 h-3 text-green-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Base Price</p>
            <p className={`text-xs font-medium ${isFree ? 'text-green-500' : 'text-foreground'}`}>
              {isFree ? 'Free (Moderator)' : `${formatUSDC(agent.basePrice)} per task`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-blue-500/10">
            <Fingerprint className="w-3 h-3 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Address</p>
            <p className="text-xs text-foreground font-mono">{truncatedAddress}</p>
          </div>
        </div>
      </div>

      {/* On-chain badge */}
      {agent.isEnsResolved && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-blue-400">
            <Link2 className="w-3 h-3" />
            <span>All metadata resolved from ENS text records on Sepolia</span>
            <Sparkles className="w-3 h-3 ml-auto" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      {isActive && (
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl">
          <BorderBeam
            lightColor={agentColor}
            lightWidth={250}
            duration={4}
            borderWidth={2}
          />
        </div>
      )}
      <FlippingCard
        frontContent={frontFace}
        backContent={backFace}
        width={280}
        height={320}
        className={`border-border bg-card ${isActive ? 'shadow-lg' : ''}`}
      />
    </div>
  );
}
