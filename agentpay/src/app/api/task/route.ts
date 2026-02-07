import { NextRequest, NextResponse } from 'next/server';
import { planTask } from '@/agents/orchestrator';
import { research } from '@/agents/researcher';
import { write } from '@/agents/writer';
import { AGENT_CONFIGS, type AgentType } from '@/lib/ai';
import { getAgentAddress, getPlatformAddress, PLATFORM_CONFIG } from '@/lib/yellow';
import { calculateTaskCost, type CostBreakdown } from '@/lib/payment';
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

interface TaskResponse {
  status: 'complete' | 'partial' | 'failed';
  result: {
    content: string;
    totalCost: string;
    agentsUsed: string[];
    subTaskCount: number;
    costBreakdown: CostBreakdown;
  };
  payments: PaymentRecord[];
  events: ActivityEvent[];
  allPaymentsSuccessful: boolean;
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
    
    // Calculate cost breakdown with platform fee
    const costBreakdown = calculateTaskCost(plan.subTasks);
    
    // Check if we have enough balance (including platform fee)
    const estimatedCost = parseFloat(costBreakdown.totalCost);
    if (estimatedCost > currentBalance) {
      return NextResponse.json(
        { 
          error: 'Insufficient balance for this task', 
          estimatedCost: costBreakdown.totalCost,
          costBreakdown,
          currentBalance,
        },
        { status: 400 }
      );
    }

    // Step 2: Execute sub-tasks and collect results
    const results: SubTaskResult[] = [];
    const payments: PaymentRecord[] = [];
    const events: ActivityEvent[] = [];
    let context = '';

    for (const subTask of plan.subTasks) {
      const config = AGENT_CONFIGS[subTask.agentType];
      const agentCost = costBreakdown.agentCosts.find(c => c.agentType === subTask.agentType);
      const cost = agentCost?.finalPrice || config.pricing.basePrice;
      const agentAddress = getAgentAddress(subTask.agentType);

      // Queue payment for client-side execution
      // Server-side doesn't have authenticated Yellow session
      console.log(`📋 Payment queued for ${config.name}: ${cost} USDC`);

      // Record payment (will be executed on client)
      const payment: PaymentRecord = {
        id: `payment-${Date.now()}-${subTask.id}`,
        from: 'user',
        to: agentAddress,
        amount: cost,
        timestamp: Date.now(),
      };
      payments.push(payment);

      // Create payment event for activity feed
      events.push({
        id: `event-payment-${Date.now()}-${subTask.id}`,
        type: 'payment',
        timestamp: Date.now(),
        data: {
          from: 'You',
          to: config.name,
          amount: cost,
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
        cost,
      });

      // Build context for next agent
      if (result.success) {
        context += `\n\n--- ${config.name} Output ---\n${result.content}`;
      }
    }

    // Add platform fee payment (if there's a fee to charge)
    if (parseFloat(costBreakdown.platformFee) > 0) {
      const platformPayment: PaymentRecord = {
        id: `payment-platform-${Date.now()}`,
        from: 'user',
        to: getPlatformAddress(),
        amount: costBreakdown.platformFee,
        timestamp: Date.now(),
      };
      payments.push(platformPayment);

      // Create platform fee event
      events.push({
        id: `event-platform-fee-${Date.now()}`,
        type: 'platform_fee',
        timestamp: Date.now(),
        data: {
          from: 'You',
          to: 'AgentPay Platform',
          amount: costBreakdown.platformFee,
          asset: 'USDC',
          feePercentage: PLATFORM_CONFIG.FEE_PERCENTAGE,
        },
      });
    }

    // Step 3: Aggregate results
    const successfulResults = results.filter(r => r.success);
    const aggregatedContent = successfulResults
      .map(r => r.content)
      .join('\n\n---\n\n');

    const agentsUsed = [...new Set(results.map(r => AGENT_CONFIGS[r.agentType].name))];

    console.log(`✅ Task complete. Total cost: ${costBreakdown.totalCost} USDC (including ${costBreakdown.platformFee} platform fee)`);

    const response: TaskResponse = {
      status: 'complete',
      result: {
        content: aggregatedContent || 'No results generated',
        totalCost: costBreakdown.totalCost,
        agentsUsed,
        subTaskCount: results.length,
        costBreakdown,
      },
      payments,
      events,
      allPaymentsSuccessful: true, // Will be updated by client after actual transfers
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Task processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Task processing failed' },
      { status: 500 }
    );
  }
}
