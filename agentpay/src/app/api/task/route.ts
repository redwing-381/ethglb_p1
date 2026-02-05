import { NextRequest, NextResponse } from 'next/server';
import { planTask } from '@/agents/orchestrator';
import { research } from '@/agents/researcher';
import { write } from '@/agents/writer';
import { AGENT_CONFIGS, type AgentType } from '@/lib/agents';
import { getAgentAddress } from '@/lib/yellow-config';
import type { ActivityEvent, PaymentRecord } from '@/types';

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
 * Execute a real Yellow transfer to an agent address.
 * NOTE: This runs on the server which doesn't have the authenticated session.
 * The actual transfers are executed on the client side after the API returns.
 * This function just returns the payment info for the client to execute.
 */
async function executeAgentPayment(
  agentType: 'orchestrator' | 'researcher' | 'writer',
  amount: string
): Promise<{ success: boolean; transactionId?: number; error?: string }> {
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
    });

  } catch (error) {
    console.error('Task processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Task processing failed' },
      { status: 500 }
    );
  }
}
