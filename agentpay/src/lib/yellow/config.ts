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
 * Debate agent types for the AI Debate Arena.
 */
export type DebateAgentType = 
  | 'moderator' 
  | 'debater_a' 
  | 'debater_b' 
  | 'fact_checker' 
  | 'judge' 
  | 'summarizer';

/**
 * Agent wallet addresses for payment routing.
 * Each debate agent has a dedicated wallet that receives USDC payments
 * for contributions during debates on the Yellow Network.
 */
export const AGENT_ADDRESSES = {
  MODERATOR:    '0x1a2B3c4D5e6F7a8B9c0D1E2F3a4B5C6D7E8F9a0b' as const,
  DEBATER_A:    '0x2b3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0B1c' as const,
  DEBATER_B:    '0x3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B1C2d' as const,
  FACT_CHECKER: '0x4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2D3e' as const,
  JUDGE:        '0x5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B1c2D3E4f' as const,
  SUMMARIZER:   '0x6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2d3E4F5a' as const,
  PLATFORM: PLATFORM_CONFIG.FEE_ADDRESS,
} as const;

export type AgentAddressKey = keyof typeof AGENT_ADDRESSES;

/**
 * Get the payment address for a specific debate agent type.
 */
export function getAgentAddress(agentType: DebateAgentType): `0x${string}` {
  const mapping: Record<DebateAgentType, `0x${string}`> = {
    moderator: AGENT_ADDRESSES.MODERATOR,
    debater_a: AGENT_ADDRESSES.DEBATER_A,
    debater_b: AGENT_ADDRESSES.DEBATER_B,
    fact_checker: AGENT_ADDRESSES.FACT_CHECKER,
    judge: AGENT_ADDRESSES.JUDGE,
    summarizer: AGENT_ADDRESSES.SUMMARIZER,
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

// ============================================================================
// ENS Agent Registry Configuration
// ============================================================================

/** Parent ENS domain for all AgentPay agents */
export const ENS_PARENT_DOMAIN = 'agentpay.eth';

/** Mapping from agent type to ENS subname */
export const AGENT_ENS_NAMES: Record<DebateAgentType | 'platform', string> = {
  moderator:    'moderator.agentpay.eth',
  debater_a:    'debater-a.agentpay.eth',
  debater_b:    'debater-b.agentpay.eth',
  fact_checker: 'factchecker.agentpay.eth',
  judge:        'judge.agentpay.eth',
  summarizer:   'summarizer.agentpay.eth',
  platform:     'platform.agentpay.eth',
};

/** ENS text record keys used for agent metadata */
export const ENS_TEXT_RECORD_KEYS = [
  'description',
  'org.agentpay.role',
  'org.agentpay.model',
  'org.agentpay.price',
] as const;

/** Complete fallback config for each agent when ENS resolution fails */
export const AGENT_FALLBACK_CONFIG: Record<DebateAgentType | 'platform', {
  address: `0x${string}`;
  name: string;
  description: string;
  model: string;
  basePrice: string;
  icon: string;
}> = {
  moderator: {
    address: AGENT_ADDRESSES.MODERATOR,
    name: 'Moderator',
    description: 'AI Moderator - Sets up and manages debates',
    model: 'anthropic/claude-3-sonnet',
    basePrice: '0.01',
    icon: 'mic',
  },
  debater_a: {
    address: AGENT_ADDRESSES.DEBATER_A,
    name: 'Debater A',
    description: 'AI Debater - Argues FOR the topic',
    model: 'anthropic/claude-3-sonnet',
    basePrice: '0.02',
    icon: 'shield',
  },
  debater_b: {
    address: AGENT_ADDRESSES.DEBATER_B,
    name: 'Debater B',
    description: 'AI Debater - Argues AGAINST the topic',
    model: 'openai/gpt-4-turbo',
    basePrice: '0.02',
    icon: 'sword',
  },
  fact_checker: {
    address: AGENT_ADDRESSES.FACT_CHECKER,
    name: 'Fact Checker',
    description: 'AI Fact Checker - Verifies claims from both sides',
    model: 'anthropic/claude-3-sonnet',
    basePrice: '0.015',
    icon: 'search',
  },
  judge: {
    address: AGENT_ADDRESSES.JUDGE,
    name: 'Judge',
    description: 'AI Judge - Scores rounds and delivers verdict',
    model: 'openai/gpt-4-turbo',
    basePrice: '0.015',
    icon: 'scale',
  },
  summarizer: {
    address: AGENT_ADDRESSES.SUMMARIZER,
    name: 'Summarizer',
    description: 'AI Summarizer - Produces the final debate summary',
    model: 'anthropic/claude-3-sonnet',
    basePrice: '0.02',
    icon: 'file-text',
  },
  platform: {
    address: PLATFORM_CONFIG.FEE_ADDRESS,
    name: 'AgentPay Platform',
    description: 'Platform fee collection',
    model: 'n/a',
    basePrice: '0',
    icon: 'landmark',
  },
};
