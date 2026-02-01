import { executeAgent, type AgentResult } from '@/lib/agents';

export async function write(task: string, context?: string): Promise<AgentResult> {
  return executeAgent('writer', task, context);
}
