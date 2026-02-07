import { executeAgent } from '@/lib/ai';
import type { AgentResult, DebateState } from '@/types';

function buildContext(state: DebateState): string {
  return state.contributions
    .map(c => `[${c.agentName} - Round ${c.round}]: ${c.content}`)
    .join('\n\n');
}

export async function summarize(debateState: DebateState): Promise<AgentResult> {
  return executeAgent(
    'summarizer',
    `Summarize this complete debate on "${debateState.topic}". Include key arguments from both sides, fact-check highlights, and the final verdict.`,
    buildContext(debateState)
  );
}
