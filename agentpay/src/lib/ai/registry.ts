/**
 * Agent Registry
 * 
 * Provides agent information for display in the UI.
 * Maps agent addresses to human-readable names and metadata.
 */

import { getAgentAddress } from '../yellow/config';
import { truncateAddress } from '../blockchain/ens';

export interface AgentInfo {
  address: `0x${string}`;
  name: string;
  description: string;
  icon: string;
}

// Agent definitions
const AGENTS: Record<string, AgentInfo> = {
  orchestrator: {
    address: getAgentAddress('orchestrator'),
    name: 'Orchestrator',
    description: 'Plans and coordinates tasks',
    icon: '🎯',
  },
  researcher: {
    address: getAgentAddress('researcher'),
    name: 'Researcher',
    description: 'Gathers information and data',
    icon: '🔍',
  },
  writer: {
    address: getAgentAddress('writer'),
    name: 'Writer',
    description: 'Creates content and documentation',
    icon: '✍️',
  },
};

// Build address-to-agent lookup
const ADDRESS_TO_AGENT: Map<string, AgentInfo> = new Map();
Object.values(AGENTS).forEach(agent => {
  ADDRESS_TO_AGENT.set(agent.address.toLowerCase(), agent);
});

/**
 * Get agent info by address
 * 
 * @param address - Ethereum address to lookup
 * @returns Agent info if found, undefined otherwise
 */
export function getAgentInfo(address: string): AgentInfo | undefined {
  return ADDRESS_TO_AGENT.get(address.toLowerCase());
}

/**
 * Get display name for an address
 * Returns agent name if known, ENS name if provided, or truncated address
 * 
 * @param address - Ethereum address
 * @param ensName - Optional ENS name
 * @returns Display name for the address
 */
export function getDisplayName(address: string, ensName?: string | null): string {
  const agent = getAgentInfo(address);
  if (agent) {
    return agent.name;
  }
  if (ensName) {
    return ensName;
  }
  return truncateAddress(address);
}

/**
 * Get all registered agents
 * 
 * @returns Array of all agent info objects
 */
export function getAllAgents(): AgentInfo[] {
  return Object.values(AGENTS);
}

/**
 * Check if an address is a known agent
 * 
 * @param address - Ethereum address to check
 * @returns True if address belongs to a known agent
 */
export function isKnownAgent(address: string): boolean {
  return ADDRESS_TO_AGENT.has(address.toLowerCase());
}
