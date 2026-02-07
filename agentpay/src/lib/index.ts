/**
 * AgentPay Library
 * 
 * Main entry point for all library exports.
 * Organized into logical modules:
 * - yellow: Yellow Network integration
 * - blockchain: Wallet and chain utilities
 * - ai: Agent execution and registry
 * - payment: Payment execution and pricing
 * - utils: General utilities
 * 
 * Note: Import from specific modules to avoid naming conflicts:
 * - import { ... } from '@/lib/yellow'
 * - import { ... } from '@/lib/blockchain'
 * - import { ... } from '@/lib/ai'
 * - import { ... } from '@/lib/payment'
 * - import { ... } from '@/lib/utils'
 */

// Re-export modules as namespaces to avoid conflicts
export * as yellow from './yellow';
export * as blockchain from './blockchain';
export * as ai from './ai';
export * as payment from './payment';
export * as utils from './utils';
