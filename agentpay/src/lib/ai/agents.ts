/**
 * AI Agent Execution
 * 
 * Provides agent execution logic using OpenRouter for AI model access.
 * Includes orchestrator for task breakdown and specialized agents for execution.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { AGENT_ADDRESSES } from '../yellow/config';
import { AGENT_PRICING, calculateTaskCost } from '../payment/price-calculator';

// Agent types
export type AgentType = 'orchestrator' | 'researcher' | 'writer';

// Agent pricing interface
export interface AgentPricing {
  basePrice: string;
  complexityMultiplier: number;
}

// Agent configuration
export interface AgentConfig {
  name: string;
  type: AgentType;
  /** @deprecated Use pricing.basePrice instead */
  costPerTask: string;
  pricing: AgentPricing;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  address: `0x${string}`;
}

// Agent result
export interface AgentResult {
  content: string;
  success: boolean;
  error?: string;
}

// Sub-task from orchestrator
export interface SubTask {
  id: string;
  description: string;
  agentType: AgentType;
  order: number;
}

// Orchestrator plan
export interface OrchestratorPlan {
  subTasks: SubTask[];
  estimatedCost: string;
}

// Agent configurations with different models per role
export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  orchestrator: {
    name: 'Orchestrator',
    type: 'orchestrator',
    costPerTask: '0', // deprecated
    pricing: AGENT_PRICING.orchestrator,
    model: 'openai/gpt-4o', // More capable for planning
    address: AGENT_ADDRESSES.ORCHESTRATOR,
    systemPrompt: `You are a task orchestrator for an AI agent marketplace. Analyze the user's task and break it down into sub-tasks.

IMPORTANT: Return ONLY a valid JSON object with this exact structure:
{
  "subTasks": [
    { "description": "specific task description", "agentType": "researcher" },
    { "description": "specific task description", "agentType": "writer" }
  ]
}

Rules:
- Use "researcher" for gathering information, analysis, or investigation tasks
- Use "writer" for creating content, summaries, or documentation tasks
- Keep sub-tasks focused and actionable
- Typically 2-4 sub-tasks per user request
- Return ONLY the JSON, no other text`,
    maxTokens: 1000,
  },
  researcher: {
    name: 'Researcher',
    type: 'researcher',
    costPerTask: '0.02', // deprecated
    pricing: AGENT_PRICING.researcher,
    model: 'openai/gpt-4o-mini', // Good for research
    address: AGENT_ADDRESSES.RESEARCHER,
    systemPrompt: `You are a research specialist in an AI agent marketplace. Your job is to gather and synthesize information on the given topic.

Provide factual, well-organized research findings. Be thorough but concise.
Format your response with clear sections and bullet points where appropriate.`,
    maxTokens: 2000,
  },
  writer: {
    name: 'Writer',
    type: 'writer',
    costPerTask: '0.02', // deprecated
    pricing: AGENT_PRICING.writer,
    model: 'anthropic/claude-3-haiku', // Good for writing
    address: AGENT_ADDRESSES.WRITER,
    systemPrompt: `You are a content writer in an AI agent marketplace. Create clear, engaging content based on the provided information.

Format your output with proper structure and readability.
Use headings, paragraphs, and lists as appropriate for the content type.`,
    maxTokens: 2000,
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
 * Execute an agent with a task
 * 
 * @param agentType - Type of agent to execute
 * @param task - Task description
 * @param context - Optional context from previous work
 * @returns Agent execution result
 */
export async function executeAgent(
  agentType: AgentType,
  task: string,
  context?: string
): Promise<AgentResult> {
  const config = AGENT_CONFIGS[agentType];
  
  try {
    const openrouter = createOpenRouterClient();
    
    const prompt = context 
      ? `Context from previous work:\n${context}\n\nTask: ${task}`
      : task;

    const { text } = await generateText({
      model: openrouter(config.model),
      system: config.systemPrompt,
      prompt,
      maxOutputTokens: config.maxTokens,
    });

    return {
      content: text,
      success: true,
    };
  } catch (error) {
    console.error(`Agent ${agentType} execution failed:`, error);
    return {
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse orchestrator response into sub-tasks
 * 
 * @param response - Raw orchestrator response
 * @returns Parsed orchestrator plan with sub-tasks
 */
export function parseOrchestratorPlan(response: string): OrchestratorPlan {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(parsed.subTasks)) {
      throw new Error('Invalid subTasks format');
    }

    const subTasks: SubTask[] = parsed.subTasks.map((st: { description: string; agentType: string }, index: number) => ({
      id: `subtask-${Date.now()}-${index}`,
      description: st.description,
      agentType: st.agentType as AgentType,
      order: index,
    }));

    // Calculate estimated cost using the new price calculator (includes platform fee)
    const costBreakdown = calculateTaskCost(subTasks);

    return {
      subTasks,
      estimatedCost: costBreakdown.totalCost,
    };
  } catch (error) {
    console.error('Failed to parse orchestrator plan:', error);
    // Return a default plan with a single researcher task
    const defaultSubTasks: SubTask[] = [{
      id: `subtask-${Date.now()}-0`,
      description: 'Research and respond to the user request',
      agentType: 'researcher',
      order: 0,
    }];
    const costBreakdown = calculateTaskCost(defaultSubTasks);
    
    return {
      subTasks: defaultSubTasks,
      estimatedCost: costBreakdown.totalCost,
    };
  }
}
