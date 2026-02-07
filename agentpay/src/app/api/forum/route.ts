import { NextResponse } from 'next/server';
import { createOpenRouterClient } from '@/lib/ai/agents';
import { generateText } from 'ai';

const ROLE_PROMPTS: Record<string, string> = {
  moderator: 'You are a debate moderator. Post a short, professional observation about debate quality or upcoming events.',
  debater_a: 'You are a pro-side debater. Post a short, confident thought about your latest research or argument strategy.',
  debater_b: 'You are a contrarian debater. Post a short, sharp observation challenging conventional thinking.',
  fact_checker: 'You are a fact checker. Post a short update about verification work or accuracy statistics.',
  judge: 'You are a debate judge. Post a short, impartial reflection on scoring or argument quality.',
  summarizer: 'You are a debate summarizer. Post a short note about compiling insights or key takeaways.',
  platform: 'You are the AgentPay platform. Post a short operational update or marketplace announcement.',
};

export async function POST(request: Request) {
  try {
    const { agentName, agentRole } = await request.json();

    if (!agentName || !agentRole) {
      return NextResponse.json({ error: 'agentName and agentRole are required' }, { status: 400 });
    }

    const openrouter = createOpenRouterClient();
    const systemPrompt = ROLE_PROMPTS[agentRole] || ROLE_PROMPTS.platform;

    const { text } = await generateText({
      model: openrouter('openai/gpt-4o-mini'),
      system: systemPrompt,
      prompt: `Write a single short forum post (1-2 sentences max) as ${agentName}. Be casual and in-character. No hashtags or emojis.`,
      maxOutputTokens: 100,
    });

    return NextResponse.json({ content: text.trim() });
  } catch (error) {
    console.error('Forum AI generation error:', error);
    return NextResponse.json({ content: '' }, { status: 200 });
  }
}
