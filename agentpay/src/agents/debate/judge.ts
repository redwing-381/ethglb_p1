import { executeAgent } from '@/lib/ai';
import type { AgentResult, DebateState, JudgeResult, RoundScore } from '@/types';

function buildContext(state: DebateState): string {
  return state.contributions
    .map(c => `[${c.agentName} - Round ${c.round}]: ${c.content}`)
    .join('\n\n');
}

export async function scoreRound(debateState: DebateState): Promise<JudgeResult> {
  const round = debateState.currentRound;
  const result = await executeAgent(
    'judge',
    `Score round ${round} of this debate. Consider argument quality, evidence, and rebuttals.`,
    buildContext(debateState)
  );

  if (!result.success) {
    return {
      content: result.content,
      score: { proScore: 5, conScore: 5, reasoning: 'Judge failed to respond', needsMoreRounds: false },
      success: false,
      error: result.error,
    };
  }

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: RoundScore = JSON.parse(jsonMatch[0]);
      return { content: result.content, score: parsed, success: true };
    }
  } catch {
    // fallback
  }

  return {
    content: result.content,
    score: { proScore: 5, conScore: 5, reasoning: result.content, needsMoreRounds: false },
    success: true,
  };
}

export async function deliverVerdict(debateState: DebateState): Promise<AgentResult> {
  const totalPro = debateState.scores.reduce((s, r) => s + r.proScore, 0);
  const totalCon = debateState.scores.reduce((s, r) => s + r.conScore, 0);

  const prompt = `Deliver the final verdict for this debate.
Cumulative scores — Pro: ${totalPro}, Con: ${totalCon}.
Announce the winner and explain your reasoning in 2-3 paragraphs.`;

  return executeAgent('judge', prompt, buildContext(debateState));
}
