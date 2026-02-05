import { NextRequest, NextResponse } from 'next/server';
import { planTask } from '@/agents/orchestrator';
import { research } from '@/agents/researcher';
import { write } from '@/agents/writer';
import { AGENT_CONFIGS, type AgentType } from '@/lib/agents';
import { getAgentAddress } from '@/lib/yellow-config';
import type { ActivityEvent, PaymentRecord } from '@/types';
import { 
  getPlatformWalletManager, 
  getAgentWallet,
  type AgentType as WalletAgentType 
} from '@/lib/agent-wallet-manager';
import { getAgentTransferService } from '@/lib/agent-transfer-service';

interface TaskRequest {
  task: string;
  channelId: string;
  currentBalance: number;
}

interface SubTaskResult {
  subTaskId: string;
  agentType: AgentType;
  content: string;
  success: boolean;
  cost: string;
}

/**
 * Check if agent wallets feature is enabled
 */
function isAgentWalletsEnabled(): boolean {
  return process.env.ENABLE_AGENT_WALLETS === 'true';
}

/**
 * Execute a real Yellow transfer to an agent address.
 * 
 * If agent wallets are enabled, uses agent-to-agent transfers.
 * Otherwise, falls back to platform-controlled model.
 */
async function executeAgentPayment(
  agentType: 'orchestrator' | 'researcher' | 'writer',
  amount: string
): Promise<{ success: boolean; transactionId?: number; error?: string }> {
  // Check if agent wallets feature is enabled
  if (isAgentWalletsEnabled()) {
    try {
      // Use agent wallet manager for direct agent-to-agent transfers
      const walletManager = getPlatformWalletManager();
      
      if (!walletManager.isInitialized()) {
        console.warn('⚠️ Agent wallet manager not initialized, falling back to platform model');
        return executePlatformPayment(agentType, amount);
      }
      
      // Get orchestrator wallet (pays other agents)
      const orchestratorWallet = getAgentWallet('orchestrator');
      const targetWallet = getAgentWallet(agentType as WalletAgentType);
      
      // If paying orchestrator itself, skip transfer
      if (agentType === 'orchestrator') {
        console.log(`📋 Orchestrator self-payment skipped: ${amount} USDC`);
        return { success: true, transactionId: Date.now() };
      }
      
      // Execute direct agent-to-agent transfer
      const transferService = getAgentTransferService();
      const result = await transferService.transferBetweenAgents(
        orchestratorWallet,
        targetWallet,
        amount,
        `Payment for ${agentType} work`
      );
      
      if (result.success) {
        console.log(`✅ Agent transfer complete: ${agentType} received ${amount} USDC (TX: ${result.transactionId})`);
        return {
          success: true,
          transactionId: typeof result.transactionId === 'number' 
            ? result.transactionId 
            : parseInt(String(result.transactionId), 10),
        };
      } else {
        console.error(`❌ Agent transfer failed: ${result.error}`);
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error('❌ Agent wallet payment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Agent payment failed',
      };
    }
  } else {
    // Fall back to platform-controlled model
    return executePlatformPayment(agentType, amount);
  }
}

/**
 * Platform-controlled payment model (fallback)
 */
function executePlatformPayment(
  agentType: 'orchestrator' | 'researcher' | 'writer',
  amount: string
): { success: boolean; transactionId?: number; error?: string } {
  // Server-side doesn't have authenticated Yellow session
  // Return success with a placeholder - actual transfer happens on client
  console.log(`📋 Payment queued for ${agentType}: ${amount} USDC (will execute on client)`);
  return { 
    success: true, 
    transactionId: Date.now(), // Placeholder - real ID comes from client transfer
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: TaskRequest = await request.json();
    const { task, channelId, currentBalance } = body;

    if (!task?.trim()) {
      return NextResponse.json(
        { error: 'Task description is required' },
        { status: 400 }
      );
    }

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    // Initialize agent wallets if enabled
    if (isAgentWalletsEnabled()) {
      try {
        const walletManager = getPlatformWalletManager();
        
        if (!walletManager.isInitialized()) {
          console.log('🤖 Initializing agent wallet manager...');
          await walletManager.initialize();
          
          // Initialize Yellow clients for agents
          console.log('🔌 Initializing Yellow clients for agents...');
          await walletManager.initializeYellowClients();
          
          console.log('✅ Agent wallets ready');
        }
      } catch (error) {
        console.error('❌ Failed to initialize agent wallets:', error);
        console.log('⚠️ Falling back to platform-controlled model');
        // Continue with platform-controlled model
      }
    }

    // Step 1: Plan the task with orchestrator
    console.log('📋 Planning task with orchestrator...');
    const plan = await planTask(task);
    
    // Check if we have enough balance
    const estimatedCost = parseFloat(plan.estimatedCost);
    if (estimatedCost > currentBalance) {
      return NextResponse.json(
        { error: 'Insufficient balance for this task', estimatedCost },
        { status: 400 }
      );
    }

    // Step 2: Execute sub-tasks and collect results
    const results: SubTaskResult[] = [];
    const payments: PaymentRecord[] = [];
    const events: ActivityEvent[] = [];
    let context = '';
    let totalCost = 0;

    for (const subTask of plan.subTasks) {
      const config = AGENT_CONFIGS[subTask.agentType];
      const cost = parseFloat(config.costPerTask);
      const agentAddress = getAgentAddress(subTask.agentType);

      // Execute the real Yellow transfer
      const paymentResult = await executeAgentPayment(
        subTask.agentType,
        config.costPerTask
      );

      if (!paymentResult.success) {
        // Handle payment failure
        if (paymentResult.error === 'INSUFFICIENT_BALANCE') {
          return NextResponse.json(
            { 
              error: 'Insufficient balance for agent payment',
              code: 'INSUFFICIENT_BALANCE',
              partialResults: results,
            },
            { status: 400 }
          );
        }
        
        // Log error but continue with task execution
        console.warn(`Payment to ${subTask.agentType} failed, continuing...`);
      }

      // Record payment with real transaction ID
      const payment: PaymentRecord = {
        id: `payment-${paymentResult.transactionId || Date.now()}-${subTask.id}`,
        from: 'user',
        to: agentAddress,
        amount: config.costPerTask,
        timestamp: Date.now(),
      };
      payments.push(payment);

      // Create payment event for activity feed
      events.push({
        id: `event-${Date.now()}-${subTask.id}`,
        type: 'payment',
        timestamp: Date.now(),
        data: {
          from: 'You',
          to: config.name,
          amount: config.costPerTask,
          asset: 'USDC',
        },
      });

      // Add subtask start event
      events.push({
        id: `event-start-${Date.now()}-${subTask.id}`,
        type: 'subtask_start',
        timestamp: Date.now(),
        data: {
          subTaskId: subTask.id,
          agentName: config.name,
          description: subTask.description,
        },
      });

      // Execute the agent
      console.log(`🤖 Executing ${config.name} agent...`);
      let result;
      if (subTask.agentType === 'researcher') {
        result = await research(subTask.description, context);
      } else if (subTask.agentType === 'writer') {
        result = await write(subTask.description, context);
      } else {
        result = { content: '', success: false, error: 'Unknown agent type' };
      }

      // Add subtask complete event
      events.push({
        id: `event-complete-${Date.now()}-${subTask.id}`,
        type: 'subtask_complete',
        timestamp: Date.now(),
        data: {
          subTaskId: subTask.id,
          agentName: config.name,
          success: result.success,
        },
      });

      results.push({
        subTaskId: subTask.id,
        agentType: subTask.agentType,
        content: result.content,
        success: result.success,
        cost: config.costPerTask,
      });

      // Build context for next agent
      if (result.success) {
        context += `\n\n--- ${config.name} Output ---\n${result.content}`;
        totalCost += cost;
      }
    }

    // Step 3: Aggregate results
    const successfulResults = results.filter(r => r.success);
    const aggregatedContent = successfulResults
      .map(r => r.content)
      .join('\n\n---\n\n');

    const agentsUsed = [...new Set(results.map(r => AGENT_CONFIGS[r.agentType].name))];

    console.log(`✅ Task complete. Total cost: ${totalCost.toFixed(2)} USDC`);
    console.log(`💰 Payment model: ${isAgentWalletsEnabled() ? 'Agent-Owned Wallets' : 'Platform-Controlled'}`);

    return NextResponse.json({
      status: 'complete',
      result: {
        content: aggregatedContent || 'No results generated',
        totalCost: totalCost.toFixed(2),
        agentsUsed,
        subTaskCount: results.length,
      },
      payments,
      events,
      paymentModel: isAgentWalletsEnabled() ? 'agent-wallets' : 'platform-controlled',
    });

  } catch (error) {
    console.error('Task processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Task processing failed' },
      { status: 500 }
    );
  }
}
