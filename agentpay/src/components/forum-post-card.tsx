/**
 * Forum Post Card Component
 * 
 * Displays a single agent forum post with icon, ENS subname,
 * content, timestamp, and optional payment badge.
 * Uses ENS registry data when available, falls back to config.
 */

'use client';

import { EnsBadge } from '@/components/ens-badge';
import { AgentAvatar, AgentIcon } from '@/components/agent-avatar';
import { formatUSDC } from '@/lib/utils';
import { AGENT_ENS_NAMES, AGENT_FALLBACK_CONFIG } from '@/lib/yellow/config';
import type { ForumPost, EnsAgentConfig, DebateAgentType } from '@/types';

interface ForumPostCardProps {
  post: ForumPost;
  agents?: EnsAgentConfig[];
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function getAgentData(agentType: DebateAgentType | 'platform', agents?: EnsAgentConfig[]) {
  const ensAgent = agents?.find(a => a.agentType === agentType);
  const fallback = AGENT_FALLBACK_CONFIG[agentType];
  return {
    name: ensAgent?.name || fallback.name,
    icon: ensAgent?.icon || fallback.icon,
    avatar: ensAgent?.avatar || null,
    ensName: AGENT_ENS_NAMES[agentType],
    isEnsResolved: ensAgent?.isEnsResolved || false,
  };
}

export function ForumPostCard({ post, agents }: ForumPostCardProps) {
  const agent = getAgentData(post.agentType, agents);

  return (
    <div className="flex gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all duration-200 group">
      <AgentAvatar avatar={agent.avatar} icon={agent.icon} name={agent.name} size="sm" className="mt-0.5 group-hover:scale-110 transition-transform" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">{agent.name}</span>
          <span className="text-xs text-blue-600 font-mono truncate">{agent.ensName}</span>
          {agent.isEnsResolved && <EnsBadge className="flex-shrink-0" />}
          {post.isAiGenerated && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium flex-shrink-0">AI</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{timeAgo(post.timestamp)}</span>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{post.content}</p>
        {post.payment && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-xs">
            <span className="text-green-400 font-medium flex items-center gap-1">
              <AgentIcon icon={getAgentData(post.payment.fromAgent, agents).icon} className="w-3 h-3" /> → <AgentIcon icon={getAgentData(post.payment.toAgent, agents).icon} className="w-3 h-3" />
            </span>
            <span className="text-green-300 font-semibold">{formatUSDC(post.payment.amount)}</span>
            <span className="text-green-500">({post.payment.reason})</span>
          </div>
        )}
      </div>
    </div>
  );
}
