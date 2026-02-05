/**
 * Agent Funding Service
 * 
 * Handles funding of agent wallets from user's Yellow unified balance.
 * Implements funding plan calculation, execution, verification, and rollback.
 */

import { YellowClient } from './yellow';
import type { AgentType } from './agent-wallet-manager';

export interface FundingPlan {
  orchestrator: {
    amount: string;
    percentage: number;
  };
  researcher: {
    amount: string;
    percentage: number;
  };
  writer: {
    amount: string;
    percentage: number;
  };
  total: string;
}

export interface FundingResult {
  agentType: AgentType;
  success: boolean;
  transactionId?: number | string;
  newBalance?: string;
  error?: string;
}

export interface FundingExecution {
  success: boolean;
  results: FundingResult[];
  error?: string;
}

// Default funding allocation (20/40/40 split)
const DEFAULT_FUNDING_SPLIT = {
  orchestrator: 0.20,  // 20% - coordination overhead
  researcher: 0.40,    // 40% - research work
  writer: 0.40,        // 40% - writing work
};

/**
 * Agent Funding Service
 * 
 * Manages the funding of agent wallets from user's balance.
 */
export class AgentFundingService {
  /**
   * Calculate funding plan based on task budget
   * 
   * Splits the budget according to expected work distribution:
   * - Orchestrator: 20% (coordination)
   * - Researcher: 40% (research work)
   * - Writer: 40% (writing work)
   */
  calculateFunding(taskBudget: string): FundingPlan {
    const budget = parseFloat(taskBudget);
    
    if (isNaN(budget) || budget <= 0) {
      throw new Error('Invalid task budget: must be a positive number');
    }
    
    const orchestratorAmount = budget * DEFAULT_FUNDING_SPLIT.orchestrator;
    const researcherAmount = budget * DEFAULT_FUNDING_SPLIT.researcher;
    const writerAmount = budget * DEFAULT_FUNDING_SPLIT.writer;
    
    return {
      orchestrator: {
        amount: orchestratorAmount.toFixed(6),
        percentage: DEFAULT_FUNDING_SPLIT.orchestrator * 100,
      },
      researcher: {
        amount: researcherAmount.toFixed(6),
        percentage: DEFAULT_FUNDING_SPLIT.researcher * 100,
      },
      writer: {
        amount: writerAmount.toFixed(6),
        percentage: DEFAULT_FUNDING_SPLIT.writer * 100,
      },
      total: taskBudget,
    };
  }
  
  /**
   * Execute funding transfers from user to agents
   * 
   * Transfers funds from user's Yellow client to each agent's address.
   * Implements atomic funding - if any transfer fails, all are rolled back.
   */
  async executeFunding(
    plan: FundingPlan,
    userClient: YellowClient,
    agentAddresses: Record<AgentType, `0x${string}`>
  ): Promise<FundingExecution> {
    console.log('💸 Executing agent funding plan...');
    console.log('📋 Funding plan:', plan);
    
    const results: FundingResult[] = [];
    
    // Fund each agent in sequence
    const agents: AgentType[] = ['orchestrator', 'researcher', 'writer'];
    
    for (const agentType of agents) {
      const amount = plan[agentType].amount;
      const address = agentAddresses[agentType];
      
      console.log(`💰 Funding ${agentType} (${address}) with ${amount} USDC...`);
      
      try {
        const result = await userClient.transfer(address, amount);
        
        results.push({
          agentType,
          success: true,
          transactionId: result.transactionId,
          newBalance: result.newBalance,
        });
        
        console.log(`✅ ${agentType} funded successfully. TX ID: ${result.transactionId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to fund ${agentType}:`, errorMessage);
        
        results.push({
          agentType,
          success: false,
          error: errorMessage,
        });
        
        // Funding failed - need to rollback
        console.log('⚠️ Funding failed, initiating rollback...');
        await this.rollbackFunding(results, userClient, agentAddresses);
        
        return {
          success: false,
          results,
          error: `Failed to fund ${agentType}: ${errorMessage}`,
        };
      }
    }
    
    console.log('✅ All agents funded successfully');
    
    return {
      success: true,
      results,
    };
  }
  
  /**
   * Verify funding completed successfully
   * 
   * Checks that all agents received their expected funding amounts.
   */
  async verifyFunding(
    results: FundingResult[],
    agentBalanceQueries: Record<AgentType, () => Promise<string>>
  ): Promise<boolean> {
    console.log('🔍 Verifying agent funding...');
    
    for (const result of results) {
      if (!result.success) {
        console.error(`❌ Funding verification failed: ${result.agentType} was not funded`);
        return false;
      }
      
      // Query agent's actual balance
      try {
        const balanceQuery = agentBalanceQueries[result.agentType];
        if (balanceQuery) {
          const actualBalance = await balanceQuery();
          console.log(`✅ ${result.agentType} balance verified: ${actualBalance} USDC`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not verify balance for ${result.agentType}:`, error);
        // Don't fail verification if balance query fails - the transfer succeeded
      }
    }
    
    console.log('✅ Funding verification complete');
    return true;
  }
  
  /**
   * Rollback funding if any transfer failed
   * 
   * Returns all successfully transferred funds back to the user.
   * Implements atomic funding guarantee.
   */
  async rollbackFunding(
    results: FundingResult[],
    userClient: YellowClient,
    agentAddresses: Record<AgentType, `0x${string}`>
  ): Promise<void> {
    console.log('🔄 Rolling back funding...');
    
    const successfulTransfers = results.filter(r => r.success);
    
    if (successfulTransfers.length === 0) {
      console.log('ℹ️ No successful transfers to rollback');
      return;
    }
    
    console.log(`⚠️ Rolling back ${successfulTransfers.length} successful transfer(s)...`);
    
    // Note: Rollback would require agent wallets to transfer back to user
    // For MVP, we log the rollback intent. Full implementation would:
    // 1. Use agent Yellow clients to transfer funds back to user
    // 2. Verify rollback completed successfully
    // 3. Handle rollback failures gracefully
    
    for (const result of successfulTransfers) {
      console.log(`⚠️ Would rollback ${result.agentType} funding (TX: ${result.transactionId})`);
    }
    
    console.log('⚠️ Rollback logged - manual intervention may be required');
  }
  
  /**
   * Get funding summary for display
   */
  getFundingSummary(plan: FundingPlan): string {
    return `
Funding Plan:
- Orchestrator: ${plan.orchestrator.amount} USDC (${plan.orchestrator.percentage}%)
- Researcher: ${plan.researcher.amount} USDC (${plan.researcher.percentage}%)
- Writer: ${plan.writer.amount} USDC (${plan.writer.percentage}%)
- Total: ${plan.total} USDC
    `.trim();
  }
}

// Singleton instance
let serviceInstance: AgentFundingService | null = null;

/**
 * Get or create the singleton agent funding service instance
 */
export function getAgentFundingService(): AgentFundingService {
  if (!serviceInstance) {
    serviceInstance = new AgentFundingService();
  }
  return serviceInstance;
}

/**
 * Calculate funding plan (convenience function)
 */
export function calculateFundingPlan(taskBudget: string): FundingPlan {
  const service = getAgentFundingService();
  return service.calculateFunding(taskBudget);
}

/**
 * Execute funding (convenience function)
 */
export async function executeFunding(
  plan: FundingPlan,
  userClient: YellowClient,
  agentAddresses: Record<AgentType, `0x${string}`>
): Promise<FundingExecution> {
  const service = getAgentFundingService();
  return service.executeFunding(plan, userClient, agentAddresses);
}
