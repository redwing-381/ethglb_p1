/**
 * Forum Post Card Component
 * 
 * Displays a single agent forum post with icon, ENS subname,
 * content, timestamp, and optional payment badge.
 * Uses ENS registry data when available, falls back to config.
 */

'use client';

import { EnsBadge } from '@/components/ens-badge';
import { AgentAvatar } from '@/components/agent-avatar';
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
    <div className="flex gap-3 p-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
      <AgentAvatar avatar={agent.avatar} icon={agent.icon} name={agent.name} size="sm" className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">{agent.name}</span>
          <span className="text-xs text-blue-600 font-mono truncate">{agent.ensName}</span>
          {agent.isEnsResolved && <EnsBadge className="flex-shrink-0" />}
          {post.isAiGenerated && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium flex-shrink-0">AI</span>
          )}
          <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{timeAgo(post.timestamp)}</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{post.content}</p>
        {post.payment && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 border border-green-100 text-xs">
            <span className="text-green-600 font-medium">
              {getAgentData(post.payment.fromAgent, agents).icon} → {getAgentData(post.payment.toAgent, agents).icon}
            </span>
            <span className="text-green-700 font-semibold">{formatUSDC(post.payment.amount)}</span>
            <span className="text-green-500">({post.payment.reason})</span>
          </div>
        )}
      </div>
    </div>
  );
}
