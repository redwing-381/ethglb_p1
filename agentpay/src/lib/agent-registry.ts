/**
 * Agent Registry
 * 
 * Centralized registry of AI agents with their metadata.
 * Maps agent addresses to human-readable information.
 */

import { truncateAddress } from './ens';
import { AGENT_ADDRESSES } from './yellow-config';

export interface AgentInfo {
  address: string;
  name: string;
  description: string;
  icon: string; // emoji or icon name
  role: 'orchestrator' | 'researcher' | 'writer';
}

/**
 * Registry of all AI agents in the system
 * Maps lowercase addresses to agent metadata
 */
export const AGENT_REGISTRY: Record<string, AgentInfo> = {
  [AGENT_ADDRESSES.ORCHESTRATOR.toLowerCase()]: {
    address: AGENT_ADDRESSES.ORCHESTRATOR,
    name: 'Orchestrator Agent',
    description: 'Breaks down tasks and coordinates other agents',
    icon: '🎯',
    role: 'orchestrator'
  },
  [AGENT_ADDRESSES.RESEARCHER.toLowerCase()]: {
    address: AGENT_ADDRESSES.RESEARCHER,
    name: 'Researcher Agent',
    description: 'Conducts web research and gathers information',
    icon: '🔍',
    role: 'researcher'
  },
  [AGENT_ADDRESSES.WRITER.toLowerCase()]: {
    address: AGENT_ADDRESSES.WRITER,
    name: 'Writer Agent',
    description: 'Synthesizes information and creates content',
    icon: '✍️',
    role: 'writer'
  }
};

/**
 * Get agent info by address (case-insensitive)
 * 
 * @param address - Ethereum address to lookup
 * @returns Agent info if found, null otherwise
 * 
 * @example
 * getAgentInfo('0x1111111111111111111111111111111111111111')
 * // Returns: { address: '0x1111...', name: 'Orchestrator Agent', ... }
 */
export function getAgentInfo(address: string | undefined): AgentInfo | null {
  if (!address) return null;
  
  const normalized = address.toLowerCase();
  return AGENT_REGISTRY[normalized] || null;
}

/**
 * Get all agents as array
 * 
 * @returns Array of all agent info objects
 */
export function getAllAgents(): AgentInfo[] {
  return Object.values(AGENT_REGISTRY);
}

/**
 * Get display name for address with priority: ENS name > Agent name > Truncated address
 * 
 * @param address - Ethereum address
 * @param ensName - Optional ENS name (if resolved)
 * @returns Display name to show in UI
 * 
 * @example
 * getDisplayName('0x1111...', null) // Returns: "Orchestrator Agent"
 * getDisplayName('0x1111...', 'orchestrator.eth') // Returns: "orchestrator.eth"
 * getDisplayName('0xabcd...', null) // Returns: "0xabcd...1234"
 */
export function getDisplayName(
  address: string | undefined,
  ensName?: string | null
): string {
  if (!address) return 'Unknown';
  
  // Priority 1: ENS name
  if (ensName) return ensName;
  
  // Priority 2: Agent registry name
  const agentInfo = getAgentInfo(address);
  if (agentInfo) return agentInfo.name;
  
  // Priority 3: Truncated address
  return truncateAddress(address);
}

/**
 * Check if an address is a known agent
 * 
 * @param address - Ethereum address to check
 * @returns true if address is a registered agent
 */
export function isAgentAddress(address: string | undefined): boolean {
  if (!address) return false;
  return getAgentInfo(address) !== null;
}

/**
 * Get agent role by address
 * 
 * @param address - Ethereum address
 * @returns Agent role or null if not an agent
 */
export function getAgentRole(address: string | undefined): 'orchestrator' | 'researcher' | 'writer' | null {
  const agentInfo = getAgentInfo(address);
  return agentInfo ? agentInfo.role : null;
}
