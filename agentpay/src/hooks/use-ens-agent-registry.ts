/**
 * ENS Agent Registry Hook
 * 
 * Discovers all debate agents from ENS subnames on Sepolia.
 * Resolves addresses and text records, merging with fallback config.
 */

'use client';

import { useMemo, useCallback } from 'react';
import { useEnsAddress } from './use-ens-address';
import { useEnsTextRecords } from './use-ens-text-records';
import { AGENT_ENS_NAMES, AGENT_FALLBACK_CONFIG } from '@/lib/yellow/config';
import type { DebateAgentType, EnsAgentConfig } from '@/types';

type AgentKey = DebateAgentType | 'platform';

// Fixed ordered list of agent keys (hooks must be called in consistent order)
const AGENT_KEYS: AgentKey[] = [
  'moderator', 'debater_a', 'debater_b',
  'fact_checker', 'judge', 'summarizer', 'platform',
];

/** Resolve a single agent from ENS, merging with fallback */
function useEnsAgent(agentType: AgentKey): { agent: EnsAgentConfig; isLoading: boolean; error: Error | null } {
  const ensName = AGENT_ENS_NAMES[agentType];
  const fallback = AGENT_FALLBACK_CONFIG[agentType];

  const { address: ensAddress, isLoading: addrLoading, error: addrError } = useEnsAddress(ensName);
  const { records, isLoading: textLoading, error: textError } = useEnsTextRecords(ensName);

  const isEnsResolved = !!ensAddress;

  // Derive display name from role record if available (e.g., "moderator" → "Moderator")
  const ensDisplayName = records.role
    ? records.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null;

  const agent: EnsAgentConfig = useMemo(() => ({
    agentType,
    ensName,
    address: (ensAddress as `0x${string}`) || fallback.address,
    name: ensDisplayName || fallback.name,
    description: records.description || fallback.description,
    model: records.model || fallback.model,
    basePrice: records.price || fallback.basePrice,
    icon: fallback.icon,
    avatar: records.avatar || null,
    isEnsResolved,
  }), [agentType, ensName, ensAddress, fallback, records, isEnsResolved, ensDisplayName]);

  return {
    agent,
    isLoading: addrLoading || textLoading,
    error: addrError || textError,
  };
}

export interface UseEnsAgentRegistryResult {
  agents: EnsAgentConfig[];
  getAgentByType: (type: AgentKey) => EnsAgentConfig | undefined;
  getAgentByAddress: (address: string) => EnsAgentConfig | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Main registry hook — resolves all 7 agents from ENS on Sepolia.
 * Each agent's address and text records are resolved individually,
 * then merged with fallback config.
 */
export function useEnsAgentRegistry(): UseEnsAgentRegistryResult {
  // Must call hooks unconditionally in fixed order (React rules of hooks)
  const moderator = useEnsAgent('moderator');
  const debaterA = useEnsAgent('debater_a');
  const debaterB = useEnsAgent('debater_b');
  const factChecker = useEnsAgent('fact_checker');
  const judge = useEnsAgent('judge');
  const summarizer = useEnsAgent('summarizer');
  const platform = useEnsAgent('platform');

  const allResults = [moderator, debaterA, debaterB, factChecker, judge, summarizer, platform];

  const agents = useMemo(
    () => allResults.map(r => r.agent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    allResults.map(r => r.agent),
  );

  const isLoading = allResults.some(r => r.isLoading);
  const error = allResults.find(r => r.error)?.error ?? null;

  const getAgentByType = useCallback(
    (type: AgentKey) => agents.find(a => a.agentType === type),
    [agents],
  );

  const getAgentByAddress = useCallback(
    (address: string) => agents.find(a => a.address.toLowerCase() === address.toLowerCase()),
    [agents],
  );

  return { agents, getAgentByType, getAgentByAddress, isLoading, error };
}
