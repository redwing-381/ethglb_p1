/**
 * Debate Pricing
 * 
 * Defines per-agent pricing for debate contributions and
 * provides cost estimation for debates.
 */

import type { DebateAgentType, DebateCostBreakdown } from '@/types';
import { PLATFORM_CONFIG } from '../yellow/config';

export interface AgentPricing {
  basePrice: string;
  label: string;
}

/**
 * Pricing per agent role.
 * judge_verdict is a separate fee for the final verdict.
 */
export const DEBATE_PRICING: Record<DebateAgentType | 'judge_verdict', AgentPricing> = {
  moderator:     { basePrice: '0.01',  label: 'Setup fee' },
  debater_a:     { basePrice: '0.02',  label: 'Per round' },
  debater_b:     { basePrice: '0.02',  label: 'Per round' },
  fact_checker:  { basePrice: '0.015', label: 'Per check' },
  judge:         { basePrice: '0.015', label: 'Per scoring' },
  judge_verdict: { basePrice: '0.02',  label: 'Final verdict' },
  summarizer:    { basePrice: '0.02',  label: 'Summary' },
};

const AGENT_NAMES: Record<DebateAgentType | 'judge_verdict', string> = {
  moderator: 'Moderator',
  debater_a: 'Debater A',
  debater_b: 'Debater B',
  fact_checker: 'Fact Checker',
  judge: 'Judge',
  judge_verdict: 'Judge (Verdict)',
  summarizer: 'Summarizer',
};

/**
 * Estimate the total cost of a debate with the given number of rounds.
 * 
 * Per debate:
 *   1 × moderator
 *   N × debater_a
 *   N × debater_b
 *   N × fact_checker
 *   N × judge (scoring)
 *   1 × judge_verdict
 *   1 × summarizer
 *   + 5% platform fee
 */
export function estimateDebateCost(rounds: number): DebateCostBreakdown {
  const agentCosts: DebateCostBreakdown['agentCosts'] = [];

  // Fixed costs (once per debate)
  const fixedRoles: Array<DebateAgentType | 'judge_verdict'> = ['moderator', 'judge_verdict', 'summarizer'];
  for (const role of fixedRoles) {
    agentCosts.push({
      agentType: role,
      agentName: AGENT_NAMES[role],
      amount: DEBATE_PRICING[role].basePrice,
      label: DEBATE_PRICING[role].label,
    });
  }

  // Per-round costs
  const perRoundRoles: Array<DebateAgentType> = ['debater_a', 'debater_b', 'fact_checker', 'judge'];
  for (const role of perRoundRoles) {
    const totalForRole = parseFloat(DEBATE_PRICING[role].basePrice) * rounds;
    agentCosts.push({
      agentType: role,
      agentName: AGENT_NAMES[role],
      amount: totalForRole.toFixed(4),
      label: `${DEBATE_PRICING[role].label} × ${rounds}`,
    });
  }

  const totalAgentCost = agentCosts.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const platformFee = totalAgentCost * (PLATFORM_CONFIG.FEE_PERCENTAGE / 100);
  const totalCost = totalAgentCost + platformFee;

  return {
    agentCosts,
    platformFee: platformFee.toFixed(4),
    platformFeePercentage: PLATFORM_CONFIG.FEE_PERCENTAGE,
    totalAgentCost: totalAgentCost.toFixed(4),
    totalCost: totalCost.toFixed(4),
    roundCount: rounds,
  };
}

/**
 * Check if a balance is sufficient for a debate with the given number of rounds.
 */
export function validateDebateBalance(balance: number, rounds: number): boolean {
  const cost = estimateDebateCost(rounds);
  return balance >= parseFloat(cost.totalCost);
}
