/**
 * Price Calculator (Legacy)
 * 
 * Kept for backward compatibility. New debate pricing is in lib/debate/pricing.ts.
 * Re-exports debate pricing types for any remaining consumers.
 */

export { estimateDebateCost, validateDebateBalance, DEBATE_PRICING } from '../debate/pricing';
export type { DebateCostBreakdown } from '@/types';
