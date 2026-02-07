/**
 * Price Calculator
 * 
 * Calculates task costs including agent fees and platform fee.
 * Implements the 5% platform fee for the AgentPay business model.
 */

import { PLATFORM_CONFIG } from '../yellow/config';
import type { AgentType } from '../ai/agents';

/** Agent pricing configuration */
export interface AgentPricing {
  /** Base price in USDC (e.g., "0.02") */
  basePrice: string;
  /** Multiplier for task complexity (default 1.0) */
  complexityMultiplier: number;
}

/** Individual agent cost in a breakdown */
export interface AgentCost {
  agentType: AgentType;
  agentName: string;
  basePrice: string;
  finalPrice: string;
}

/** Complete cost breakdown for a task */
export interface CostBreakdown {
  agentCosts: AgentCost[];
  platformFee: string;
  platformFeePercentage: number;
  totalAgentCost: string;
  totalCost: string;
}

/** Sub-task for cost calculation */
export interface SubTaskForPricing {
  agentType: AgentType;
}

/** Agent pricing configuration by type */
export const AGENT_PRICING: Record<AgentType, AgentPricing> = {
  orchestrator: { basePrice: '0', complexityMultiplier: 1.0 },
  researcher: { basePrice: '0.02', complexityMultiplier: 1.0 },
  writer: { basePrice: '0.02', complexityMultiplier: 1.0 },
};

/** Agent display names */
const AGENT_NAMES: Record<AgentType, string> = {
  orchestrator: 'Orchestrator',
  researcher: 'Researcher',
  writer: 'Writer',
};

/**
 * Calculate the total cost for a task including platform fee.
 * 
 * @param subTasks - Array of sub-tasks with agent types
 * @param complexity - Complexity multiplier (default 1.0)
 * @returns Complete cost breakdown
 * 
 * @example
 * ```ts
 * const breakdown = calculateTaskCost([
 *   { agentType: 'researcher' },
 *   { agentType: 'writer' }
 * ]);
 * // Returns: { totalCost: '0.0420', platformFee: '0.0020', ... }
 * ```
 */
export function calculateTaskCost(
  subTasks: SubTaskForPricing[],
  complexity: number = 1.0
): CostBreakdown {
  // Calculate individual agent costs
  const agentCosts: AgentCost[] = subTasks.map(task => {
    const pricing = AGENT_PRICING[task.agentType];
    const basePrice = parseFloat(pricing.basePrice);
    const finalPrice = basePrice * pricing.complexityMultiplier * complexity;
    
    return {
      agentType: task.agentType,
      agentName: AGENT_NAMES[task.agentType],
      basePrice: pricing.basePrice,
      finalPrice: finalPrice.toFixed(4),
    };
  });
  
  // Calculate total agent cost
  const totalAgentCost = agentCosts.reduce(
    (sum, cost) => sum + parseFloat(cost.finalPrice),
    0
  );
  
  // Calculate platform fee (5% of total agent costs)
  const platformFeePercentage = PLATFORM_CONFIG.FEE_PERCENTAGE;
  const platformFee = totalAgentCost * (platformFeePercentage / 100);
  
  // Calculate total cost
  const totalCost = totalAgentCost + platformFee;
  
  return {
    agentCosts,
    platformFee: platformFee.toFixed(4),
    platformFeePercentage,
    totalAgentCost: totalAgentCost.toFixed(4),
    totalCost: totalCost.toFixed(4),
  };
}

/**
 * Get the base price for an agent type.
 * 
 * @param agentType - The type of agent
 * @returns Base price as a string
 */
export function getAgentBasePrice(agentType: AgentType): string {
  return AGENT_PRICING[agentType].basePrice;
}

/**
 * Check if an agent type is free (zero cost).
 * 
 * @param agentType - The type of agent
 * @returns True if the agent has zero base price
 */
export function isAgentFree(agentType: AgentType): boolean {
  return parseFloat(AGENT_PRICING[agentType].basePrice) === 0;
}
