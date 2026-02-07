/**
 * Agent Address Generator
 * 
 * Generates deterministic Ethereum addresses for agents using keccak256 hashing.
 * This ensures consistent addresses across deployments while avoiding placeholder values.
 */

import { keccak256, toHex, getAddress } from 'viem';

/** Seed prefix for deterministic address generation */
const ADDRESS_SEED = 'agentpay-v1';

/**
 * Generate a deterministic Ethereum address from an agent type.
 * Uses keccak256 hash of the agent name prefixed with a seed.
 * 
 * @param agentType - The type of agent (e.g., 'orchestrator', 'researcher', 'writer', 'platform')
 * @returns A checksummed Ethereum address
 * 
 * @example
 * ```ts
 * const addr = generateAgentAddress('orchestrator');
 * // Returns: '0x...' (consistent across calls)
 * ```
 */
export function generateAgentAddress(agentType: string): `0x${string}` {
  const input = `${ADDRESS_SEED}:${agentType}`;
  const hash = keccak256(toHex(input));
  // Take first 20 bytes (40 hex chars) after 0x prefix
  const addressHex = `0x${hash.slice(2, 42)}` as `0x${string}`;
  return getAddress(addressHex); // Returns checksummed address
}

/**
 * Verify that an address is a valid checksummed Ethereum address.
 * 
 * @param address - The address to verify
 * @returns True if the address is valid and checksummed
 */
export function isValidChecksummedAddress(address: string): boolean {
  try {
    const checksummed = getAddress(address as `0x${string}`);
    return checksummed === address;
  } catch {
    return false;
  }
}
