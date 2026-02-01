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

// Yellow Network Contract Addresses on Sepolia
export const CUSTODY_ADDRESS = '0x019B65A265EB3363822f2752141b3dF16131B262' as const;
export const ADJUDICATOR_ADDRESS = '0x7c7ccbc98469190849BCC6c926307794fDfB11F2' as const;

// Test Token Configuration
export const TEST_TOKEN = 'ytest.usd';
export const TOKEN_DECIMALS = 6;

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
