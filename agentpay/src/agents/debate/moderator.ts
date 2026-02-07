import { executeAgent } from '@/lib/ai';
import type { AgentResult } from '@/types';

export async function moderate(topic: string): Promise<AgentResult> {
  return executeAgent('moderator', `Introduce this debate topic: "${topic}"`);
}
