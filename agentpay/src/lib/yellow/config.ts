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
// Platform Fee Configuration
// ============================================================================

/**
 * Platform fee configuration for the AgentPay business model.
 * A 5% fee is charged on all agent payments to demonstrate sustainability.
 */
export const PLATFORM_CONFIG = {
  /** Platform fee percentage (5%) */
  FEE_PERCENTAGE: 5,
  /** Platform fee recipient address */
  FEE_ADDRESS: '0x6298feA679a1f6c547D15fe916c44229CE6D7359' as const,
} as const;

// ============================================================================
// Agent Address Configuration
// ============================================================================

/**
 * Agent wallet addresses for payment routing.
 * These addresses receive payments when agents complete work.
 * 
 * Each agent has a dedicated wallet that receives USDC payments
 * for completed tasks on the Yellow Network.
 */
export const AGENT_ADDRESSES = {
  ORCHESTRATOR: '0x6894542573F3B5ed2f8d3125b4f08e2777d77523' as const,
  RESEARCHER: '0xee9956a99bCCf064EA3f02e8878E57A5B53E311B' as const,
  WRITER: '0xBE26c2208763aEB6e793758621F528Bc302b4A80' as const,
  PLATFORM: PLATFORM_CONFIG.FEE_ADDRESS,
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
 * Get the platform fee address for fee collection.
 * 
 * @returns The platform fee recipient address
 */
export function getPlatformAddress(): `0x${string}` {
  return PLATFORM_CONFIG.FEE_ADDRESS;
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
