/**
 * Yellow Network Configuration Constants
 * 
 * Configuration for connecting to Yellow Network's sandbox clearnode
 * on Sepolia testnet for the AgentPay hackathon project.
 */

// Clearnode WebSocket endpoint
export const CLEARNODE_URL = 'wss://clearnet-sandbox.yellow.com/ws';

// Sepolia Testnet Chain ID
export const CHAIN_ID = 11155111;

// Yellow Network Contract Addresses on Sepolia (checksummed)
export const CUSTODY_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131b262' as const;
export const ADJUDICATOR_ADDRESS = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2' as const;

// Test Token Configuration
export const TEST_TOKEN = 'ytest.usd';
export const TOKEN_DECIMALS = 6;
// Known test token contract address on Sepolia (ytest.usd)
export const TEST_TOKEN_ADDRESS = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb' as const;

// Timing Constants
export const CHALLENGE_DURATION = 3600; // 1 hour in seconds
export const SESSION_EXPIRY = 86400000; // 24 hours in milliseconds
export const REQUEST_TIMEOUT = 30000; // 30 seconds in milliseconds

// Reconnection Configuration
export const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000] as const;
export const MAX_RECONNECT_ATTEMPTS = 6;

// Application Configuration
export const APPLICATION_NAME = 'AgentPay';
export const DEFAULT_SCOPE = 'transfer,app.create';

// LocalStorage Key for State Persistence
export const STORAGE_KEY = 'agentpay_yellow_state';

// ============================================================================
// Agent Address Configuration
// ============================================================================

/**
 * Fixed agent addresses for payment routing.
 * These addresses receive payments when agents complete work.
 * 
 * Note: These are platform-controlled addresses that represent each agent.
 * In Yellow's unified balance system, these addresses will accumulate earnings
 * from completed tasks. The platform controls these addresses.
 */
export const AGENT_ADDRESSES = {
  ORCHESTRATOR: '0x1111111111111111111111111111111111111111' as const,
  RESEARCHER: '0x2222222222222222222222222222222222222222' as const,
  WRITER: '0x3333333333333333333333333333333333333333' as const,
} as const;

export type AgentAddressKey = keyof typeof AGENT_ADDRESSES;

/**
 * Get the payment address for a specific agent type.
 * 
 * @param agentType - The type of agent ('orchestrator', 'researcher', 'writer')
 * @returns The Ethereum address for that agent
 */
export function getAgentAddress(agentType: 'orchestrator' | 'researcher' | 'writer'): `0x${string}` {
  const mapping: Record<string, `0x${string}`> = {
    orchestrator: AGENT_ADDRESSES.ORCHESTRATOR,
    researcher: AGENT_ADDRESSES.RESEARCHER,
    writer: AGENT_ADDRESSES.WRITER,
  };
  return mapping[agentType];
}

/**
 * Combined configuration object for convenience
 */
export const YELLOW_CONFIG = {
  // Clearnode
  CLEARNODE_URL,
  
  // Sepolia Testnet
  CHAIN_ID,
  CUSTODY_ADDRESS,
  ADJUDICATOR_ADDRESS,
  
  // Test Token
  TEST_TOKEN,
  TEST_TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  
  // Timing
  CHALLENGE_DURATION,
  SESSION_EXPIRY,
  REQUEST_TIMEOUT,
  
  // Reconnection
  RECONNECT_DELAYS,
  MAX_RECONNECT_ATTEMPTS,
  
  // Application
  APPLICATION_NAME,
  DEFAULT_SCOPE,
  
  // Storage
  STORAGE_KEY,
} as const;

export default YELLOW_CONFIG;
