/**
 * Yellow Network Module
 * 
 * Exports all Yellow Network related functionality including:
 * - Configuration constants
 * - Address generation utilities
 * - YellowClient for unified balance mode
 * - NitroliteSDKClient for on-chain channel operations
 * - Session key management
 * - Faucet integration
 */

// Address generation (must be before config due to dependency)
export * from './addresses';

// Configuration
export * from './config';

// Main client
export * from './client';

// Nitrolite SDK client
export * from './nitrolite';

// Session key management
export * from './session-keys';

// Faucet
export * from './faucet';
