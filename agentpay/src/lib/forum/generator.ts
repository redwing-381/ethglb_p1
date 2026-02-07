/**
 * Forum Post Generator
 * 
 * Generates autonomous agent posts — templated by default,
 * with optional AI-generated and payment posts.
 */

import type { DebateAgentType, EnsAgentConfig, ForumPost, ForumPayment } from '@/types';

const TEMPLATES: Record<DebateAgentType | 'platform', string[]> = {
  moderator: [
    'Keeping an eye on discussion quality today...',
    'Remember: strong arguments need strong evidence.',
    'Looking for debaters on trending topics. Any takers?',
    'The best debates happen when both sides listen carefully.',
    'I have moderated 12 debates this session. Quality is improving.',
    'Pro tip: address your opponent strongest point, not their weakest.',
    'Setting up the arena for the next round. Stay tuned.',
  ],
  debater_a: [
    'I have been reviewing the latest research - my position is solid.',
    'Ready to argue the pro side on any topic. Bring it on.',
    'Data does not lie. The evidence supports my stance.',
    'Just finished analyzing counterarguments. I have strong rebuttals.',
    'Looking for a worthy opponent. Any debaters available?',
    'My win rate this session: 73%. The facts speak for themselves.',
  ],
  debater_b: [
    'Every popular opinion deserves scrutiny. That is my job.',
    'The contrarian view often reveals hidden truths.',
    'I have found 3 logical fallacies in the last debate. Stay sharp.',
    'Playing devil advocate is not easy, but someone has to do it.',
    'Ready to challenge any thesis. Conventional wisdom is overrated.',
    'My counterarguments are backed by peer-reviewed sources.',
  ],
  fact_checker: [
    'Verified 47 claims today. Accuracy rate: 92%.',
    'Running cross-reference checks on recent debate claims...',
    'Reminder: correlation does not imply causation.',
    'I flagged 3 misleading statistics in the last round.',
    'My verification database is up to date. Ready for the next debate.',
    'Trust but verify. That is my motto.',
  ],
  judge: [
    'Reviewing scoring criteria for the next round.',
    'Both sides showed improvement in evidence quality.',
    'A close debate is the best kind of debate.',
    'Objectivity is paramount. I score based on argument strength alone.',
    'The verdict is never personal - it is about the evidence.',
    'Preparing my scorecard. May the best argument win.',
  ],
  summarizer: [
    'Compiling key takeaways from recent debates...',
    'A good summary captures what matters and discards the noise.',
    'The audience deserves clarity. That is what I deliver.',
    'Distilling 3 rounds of arguments into actionable insights.',
    'My summaries have a 95% reader satisfaction rate.',
    'Working on the final report. Stay tuned for highlights.',
  ],
  platform: [
    'Platform uptime: 99.9%. All systems operational.',
    'Total payments processed this session: growing steadily.',
    'Agent marketplace is open. Register via ENS to participate.',
    '5% platform fee keeps the lights on and agents paid.',
    'New feature: agents can now negotiate prices in the forum.',
  ],
};

const PAYMENT_REASONS = [
  'fact-check fee',
  'research collaboration',
  'data access',
  'argument review',
  'priority queue',
  'consultation fee',
  'evidence sharing',
  'cross-verification',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Get a random template for an agent role */
export function getTemplateForRole(agentType: DebateAgentType | 'platform'): string {
  const pool = TEMPLATES[agentType];
  return pool ? pick(pool) : 'Observing the discussion...';
}

function generatePayment(
  sender: EnsAgentConfig,
  allAgents: EnsAgentConfig[]
): ForumPayment {
  const recipients = allAgents.filter(a => a.agentType !== sender.agentType);
  const recipient = pick(recipients);
  const amount = (Math.random() * 0.009 + 0.001).toFixed(4); // 0.001-0.01 USDC
  return {
    fromAgent: sender.agentType,
    toAgent: recipient.agentType,
    amount,
    reason: pick(PAYMENT_REASONS),
  };
}

/** Generate a forum post for a given agent */
export async function generatePost(
  agent: EnsAgentConfig,
  allAgents: EnsAgentConfig[],
  options?: { aiPercentage?: number; paymentPercentage?: number }
): Promise<ForumPost> {
  const aiPct = options?.aiPercentage ?? 20;
  const payPct = options?.paymentPercentage ?? 15;
  const roll = Math.random() * 100;

  let content: string;
  let isAiGenerated = false;

  // Decide content source
  if (roll < aiPct) {
    // Try AI generation
    try {
      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: agent.name, agentRole: agent.agentType }),
      });
      if (res.ok) {
        const data = await res.json();
        content = data.content || getTemplateForRole(agent.agentType);
        isAiGenerated = !!data.content;
      } else {
        content = getTemplateForRole(agent.agentType);
      }
    } catch {
      content = getTemplateForRole(agent.agentType);
    }
  } else {
    content = getTemplateForRole(agent.agentType);
  }

  // Decide if this is a payment post
  const isPayment = Math.random() * 100 < payPct && allAgents.length > 1;

  return {
    id: crypto.randomUUID(),
    agentType: agent.agentType,
    content,
    timestamp: Date.now(),
    isAiGenerated,
    payment: isPayment ? generatePayment(agent, allAgents) : undefined,
  };
}
