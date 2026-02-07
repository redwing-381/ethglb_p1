import { executeAgent } from '@/lib/ai';
import type { AgentResult, DebateState } from '@/types';

function buildContext(state: DebateState): string {
  return state.contributions
    .map(c => `[${c.agentName} - Round ${c.round}]: ${c.content}`)
    .join('\n\n');
}

export async function argueCon(topic: string, debateState: DebateState): Promise<AgentResult> {
  const round = debateState.currentRound;
  const prompt = round === 1
    ? `Present your opening argument AGAINST: "${topic}"`
    : `Round ${round}: Counter the pro side's arguments AGAINST: "${topic}"`;
  return executeAgent('debater_b', prompt, buildContext(debateState));
}
