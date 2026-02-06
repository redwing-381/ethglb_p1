import { executeAgent, parseOrchestratorPlan, type OrchestratorPlan } from '@/lib/ai';

export async function planTask(task: string): Promise<OrchestratorPlan> {
  const result = await executeAgent('orchestrator', task);
  
  if (!result.success) {
    console.error('Orchestrator failed:', result.error);
    // Return fallback plan
    return {
      subTasks: [{
        id: `subtask-${Date.now()}-0`,
        description: task,
        agentType: 'researcher',
        order: 0,
      }],
      estimatedCost: '0.02',
    };
  }

  return parseOrchestratorPlan(result.content);
}
