import { executeAgent } from '@/lib/ai';
import type { AgentResult, DebateState, FactCheckResult } from '@/types';

function buildContext(state: DebateState): string {
  return state.contributions
    .map(c => `[${c.agentName} - Round ${c.round}]: ${c.content}`)
    .join('\n\n');
}

export async function checkFacts(debateState: DebateState): Promise<AgentResult & { factCheckResult?: FactCheckResult }> {
  const round = debateState.currentRound;
  const result = await executeAgent(
    'fact_checker',
    `Fact-check the claims made in round ${round} of this debate.`,
    buildContext(debateState)
  );

  if (!result.success) return result;

  // Try to parse the JSON response
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: FactCheckResult = JSON.parse(jsonMatch[0]);
      return { ...result, factCheckResult: parsed };
    }
  } catch {
    // If parsing fails, return the raw content
  }

  return {
    ...result,
    factCheckResult: {
      claims: [],
      overallAssessment: result.content,
    },
  };
}
