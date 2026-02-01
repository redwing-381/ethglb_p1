import { NextRequest, NextResponse } from 'next/server';
import { planTask } from '@/agents/orchestrator';
import { research } from '@/agents/researcher';
import { write } from '@/agents/writer';
import { AGENT_CONFIGS, type AgentType, type SubTask } from '@/lib/agents';
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

      // Record payment event
      const payment: PaymentRecord = {
        id: `payment-${Date.now()}-${subTask.id}`,
        from: 'user',
        to: config.name,
        amount: config.costPerTask,
        timestamp: Date.now(),
      };
      payments.push(payment);

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

      // Execute the agent
      let result;
      if (subTask.agentType === 'researcher') {
        result = await research(subTask.description, context);
      } else if (subTask.agentType === 'writer') {
        result = await write(subTask.description, context);
      } else {
        result = { content: '', success: false, error: 'Unknown agent type' };
      }

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
