/**
 * AI Agent Execution - Debate Arena
 * 
 * Provides agent execution logic using OpenRouter for AI model access.
 * Configured for the 6-agent debate system.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { AGENT_ADDRESSES, type DebateAgentType } from '../yellow/config';
import type { AgentResult } from '@/types';

export interface DebateAgentConfig {
  name: string;
  type: DebateAgentType;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  address: `0x${string}`;
  icon: string;
  description: string;
}

export const DEBATE_AGENT_CONFIGS: Record<DebateAgentType, DebateAgentConfig> = {
  moderator: {
    name: 'Moderator',
    type: 'moderator',
    model: 'openai/gpt-4o',
    address: AGENT_ADDRESSES.MODERATOR,
    icon: 'mic',
    description: 'Sets up and manages the debate',
    maxTokens: 800,
    systemPrompt: `You are a debate moderator. Given a topic, introduce the debate by:
1. Stating the topic clearly
2. Explaining why it matters
3. Setting ground rules (be respectful, cite evidence, stay on topic)
4. Inviting both sides to present their arguments

Keep your introduction concise (2-3 paragraphs). Be neutral and professional.`,
  },
  debater_a: {
    name: 'Debater A',
    type: 'debater_a',
    model: 'openai/gpt-4o',
    address: AGENT_ADDRESSES.DEBATER_A,
    icon: 'shield',
    description: 'Argues FOR the topic',
    maxTokens: 1200,
    systemPrompt: `You are Debater A, arguing FOR the given topic. Build strong, evidence-based arguments.

Structure your argument:
1. Main thesis statement
2. 2-3 supporting points with reasoning
3. Address potential counterarguments preemptively

If previous rounds exist, respond to the opposing side's points directly. Be persuasive but factual.`,
  },
  debater_b: {
    name: 'Debater B',
    type: 'debater_b',
    model: 'openai/gpt-4o',
    address: AGENT_ADDRESSES.DEBATER_B,
    icon: 'sword',
    description: 'Argues AGAINST the topic',
    maxTokens: 1200,
    systemPrompt: `You are Debater B, arguing AGAINST the given topic. Build strong, evidence-based counter-arguments.

Structure your argument:
1. Main counter-thesis
2. 2-3 points challenging the pro side
3. Present alternative perspectives

If previous rounds exist, directly rebut the opposing side's latest points. Be persuasive but factual.`,
  },
  fact_checker: {
    name: 'Fact Checker',
    type: 'fact_checker',
    model: 'openai/gpt-4o-mini',
    address: AGENT_ADDRESSES.FACT_CHECKER,
    icon: 'search',
    description: 'Verifies claims from both sides',
    maxTokens: 1000,
    systemPrompt: `You are a fact checker. Analyze claims made by both debaters in the current round.

Return ONLY valid JSON in this format:
{
  "claims": [
    {
      "claim": "the specific claim",
      "source": "debater_a" or "debater_b",
      "verdict": "accurate" or "misleading" or "false" or "unverifiable",
      "explanation": "brief explanation"
    }
  ],
  "overallAssessment": "brief overall assessment of factual accuracy this round"
}

Check 2-4 key claims per round. Be fair to both sides.`,
  },
  judge: {
    name: 'Judge',
    type: 'judge',
    model: 'openai/gpt-4o',
    address: AGENT_ADDRESSES.JUDGE,
    icon: 'scale',
    description: 'Scores rounds and delivers verdict',
    maxTokens: 800,
    systemPrompt: `You are the debate judge. Score the current round based on argument quality, evidence, and persuasiveness.

Return ONLY valid JSON:
{
  "proScore": <1-10>,
  "conScore": <1-10>,
  "reasoning": "brief explanation of scores",
  "needsMoreRounds": <true if scores are within 2 points of each other, false otherwise>
}

Be fair and objective. Consider argument strength, evidence quality, and rebuttal effectiveness.`,
  },
  summarizer: {
    name: 'Summarizer',
    type: 'summarizer',
    model: 'openai/gpt-4o-mini',
    address: AGENT_ADDRESSES.SUMMARIZER,
    icon: 'file-text',
    description: 'Produces the final debate summary',
    maxTokens: 1000,
    systemPrompt: `You are a debate summarizer. Given the full debate transcript, produce a concise summary:

1. Topic and key question
2. Strongest arguments from each side (2-3 bullet points each)
3. Key facts verified or disputed
4. Final assessment of which side presented a stronger case and why

Be balanced and informative. This is the final takeaway for the audience.`,
  },
};

/**
 * Create OpenRouter client for AI model access
 */
export function createOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }
  return createOpenRouter({ apiKey });
}

/**
 * Execute a debate agent with a prompt
 */
export async function executeAgent(
  agentType: DebateAgentType,
  prompt: string,
  context?: string
): Promise<AgentResult> {
  const config = DEBATE_AGENT_CONFIGS[agentType];

  try {
    const openrouter = createOpenRouterClient();

    const fullPrompt = context
      ? `Context from debate so far:\n${context}\n\n${prompt}`
      : prompt;

    const { text } = await generateText({
      model: openrouter(config.model),
      system: config.systemPrompt,
      prompt: fullPrompt,
      maxOutputTokens: config.maxTokens,
    });

    return { content: text, success: true };
  } catch (error) {
    console.error(`Agent ${agentType} execution failed:`, error);
    return {
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
