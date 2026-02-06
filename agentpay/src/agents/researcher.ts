import { executeAgent, type AgentResult } from '@/lib/ai';

export async function research(task: string, context?: string): Promise<AgentResult> {
  return executeAgent('researcher', task, context);
}
