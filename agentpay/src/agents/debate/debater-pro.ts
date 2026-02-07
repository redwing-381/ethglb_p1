import { executeAgent } from '@/lib/ai';
import type { AgentResult, DebateState } from '@/types';

function buildContext(state: DebateState): string {
  return state.contributions
    .map(c => `[${c.agentName} - Round ${c.round}]: ${c.content}`)
    .join('\n\n');
}

export async function argueFor(topic: string, debateState: DebateState): Promise<AgentResult> {
  const round = debateState.currentRound;
  const prompt = round === 1
    ? `Present your opening argument FOR: "${topic}"`
    : `Round ${round}: Respond to the opposition and strengthen your case FOR: "${topic}"`;
  return executeAgent('debater_a', prompt, buildContext(debateState));
}
