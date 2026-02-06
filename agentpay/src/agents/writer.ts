import { executeAgent, type AgentResult } from '@/lib/ai';

export async function write(task: string, context?: string): Promise<AgentResult> {
  return executeAgent('writer', task, context);
}
