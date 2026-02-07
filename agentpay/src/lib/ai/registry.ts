/**
 * Agent Registry
 * 
 * Provides agent information for display in the UI.
 * Maps agent addresses to human-readable names and metadata.
 */

import { getAgentAddress, type DebateAgentType } from '../yellow/config';
import { truncateAddress } from '../blockchain/ens';

export interface AgentInfo {
  address: `0x${string}`;
  name: string;
  description: string;
  icon: string;
}

// Debate agent definitions
const AGENTS: Record<DebateAgentType, AgentInfo> = {
  moderator: {
    address: getAgentAddress('moderator'),
    name: 'Moderator',
    description: 'Sets up and manages the debate',
    icon: '🎙️',
  },
  debater_a: {
    address: getAgentAddress('debater_a'),
    name: 'Debater A',
    description: 'Argues FOR the topic',
    icon: '🔵',
  },
  debater_b: {
    address: getAgentAddress('debater_b'),
    name: 'Debater B',
    description: 'Argues AGAINST the topic',
    icon: '🔴',
  },
  fact_checker: {
    address: getAgentAddress('fact_checker'),
    name: 'Fact Checker',
    description: 'Verifies claims from both sides',
    icon: '🔍',
  },
  judge: {
    address: getAgentAddress('judge'),
    name: 'Judge',
    description: 'Scores rounds and delivers verdict',
    icon: '⚖️',
  },
  summarizer: {
    address: getAgentAddress('summarizer'),
    name: 'Summarizer',
    description: 'Produces the final debate summary',
    icon: '📝',
  },
};

// Build address-to-agent lookup
const ADDRESS_TO_AGENT: Map<string, AgentInfo> = new Map();
Object.values(AGENTS).forEach(agent => {
  ADDRESS_TO_AGENT.set(agent.address.toLowerCase(), agent);
});

/**
 * Get agent info by address
 */
export function getAgentInfo(address: string): AgentInfo | undefined {
  return ADDRESS_TO_AGENT.get(address.toLowerCase());
}

/**
 * Get display name for an address
 * Returns agent name if known, ENS name if provided, or truncated address
 */
export function getDisplayName(address: string, ensName?: string | null): string {
  const agent = getAgentInfo(address);
  if (agent) return agent.name;
  if (ensName) return ensName;
  return truncateAddress(address);
}

/**
 * Get all registered agents
 */
export function getAllAgents(): AgentInfo[] {
  return Object.values(AGENTS);
}

/**
 * Check if an address is a known agent
 */
export function isKnownAgent(address: string): boolean {
  return ADDRESS_TO_AGENT.has(address.toLowerCase());
}

/**
 * Get agent info by type
 */
export function getAgentByType(agentType: DebateAgentType): AgentInfo {
  return AGENTS[agentType];
}

// ============================================================================
// ENS-Aware Registry Functions
// ============================================================================

import type { EnsAgentConfig } from '@/types';

/**
 * Get display name preferring ENS subname for known agents.
 * Falls back to agent name, then truncated address.
 */
export function getEnsDisplayName(
  address: string,
  ensAgents: EnsAgentConfig[]
): string {
  const agent = ensAgents.find(a => a.address.toLowerCase() === address.toLowerCase());
  if (agent) return agent.ensName;
  // Fall back to hardcoded registry
  const info = getAgentInfo(address);
  if (info) return info.name;
  return truncateAddress(address);
}

/**
 * Get agent config by address from ENS registry data
 */
export function getEnsAgentByAddress(
  address: string,
  ensAgents: EnsAgentConfig[]
): EnsAgentConfig | undefined {
  return ensAgents.find(a => a.address.toLowerCase() === address.toLowerCase());
}
