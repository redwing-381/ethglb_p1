/**
 * Debate Engine
 * 
 * Core orchestration logic for the AI Debate Arena.
 * Runs the full debate pipeline and produces payments + events.
 */

import { moderate, argueFor, argueCon, checkFacts, scoreRound, deliverVerdict, summarize } from '@/agents/debate';
import { getAgentAddress, getPlatformAddress, PLATFORM_CONFIG, type DebateAgentType } from '../yellow/config';
import { DEBATE_PRICING, estimateDebateCost } from './pricing';
import { DEBATE_AGENT_CONFIGS } from '../ai/agents';
import type {
  DebateState,
  DebateTranscript,
  DebateRound,
  DebateCostBreakdown,
  DebateStepEvent,
  DebateContribution,
  PaymentRecord,
  ActivityEvent,
  RoundScore,
  FactCheckResult,
} from '@/types';

const MIN_ROUNDS = 2;
const MAX_ROUNDS = 3;

export interface DebateEngineResult {
  debate: DebateTranscript;
  payments: PaymentRecord[];
  events: ActivityEvent[];
  costBreakdown: DebateCostBreakdown;
}

/**
 * Validate a debate topic.
 */
export function validateTopic(topic: string): boolean {
  return typeof topic === 'string' && topic.trim().length > 0;
}

/**
 * Run a full debate on the given topic.
 */
export async function runDebate(
  topic: string,
  onStep?: (event: DebateStepEvent) => void
): Promise<DebateEngineResult> {
  if (!validateTopic(topic)) {
    throw new Error('Debate topic must be a non-empty string');
  }

  const payments: PaymentRecord[] = [];
  const events: ActivityEvent[] = [];
  const rounds: DebateRound[] = [];

  const state: DebateState = {
    topic: topic.trim(),
    currentRound: 0,
    maxRounds: MAX_ROUNDS,
    contributions: [],
    scores: [],
    isComplete: false,
  };

  let eventCounter = 0;
  const nextId = () => `debate-${Date.now()}-${eventCounter++}`;

  // Helper: add a contribution to state
  function addContribution(
    role: DebateAgentType,
    content: string,
    round: number,
    score?: RoundScore,
    factCheckResult?: FactCheckResult
  ) {
    const contrib: DebateContribution = {
      role,
      agentName: DEBATE_AGENT_CONFIGS[role].name,
      content,
      round,
      timestamp: Date.now(),
      score,
      factCheckResult,
    };
    state.contributions.push(contrib);
  }

  // Helper: emit step events
  function emitStep(step: DebateStepEvent['step'], round: number, agentType: DebateAgentType, status: 'started' | 'completed') {
    const config = DEBATE_AGENT_CONFIGS[agentType];
    onStep?.({ step, round, agentName: config.name, status });

    if (status === 'started') {
      events.push({
        id: nextId(),
        type: 'subtask_start',
        timestamp: Date.now(),
        data: { subTaskId: `${step}-r${round}`, agentName: config.name, description: `${config.name}: ${step}` },
      });
    } else {
      events.push({
        id: nextId(),
        type: 'subtask_complete',
        timestamp: Date.now(),
        data: { subTaskId: `${step}-r${round}`, agentName: config.name, success: true },
      });
    }
  }

  // Helper: add payment
  function addPayment(agentType: DebateAgentType | 'judge_verdict' | 'platform', amount: string) {
    const to = agentType === 'platform'
      ? getPlatformAddress()
      : agentType === 'judge_verdict'
        ? getAgentAddress('judge')
        : getAgentAddress(agentType);

    const agentName = agentType === 'platform'
      ? 'AgentPay Platform'
      : agentType === 'judge_verdict'
        ? 'Judge (Verdict)'
        : DEBATE_AGENT_CONFIGS[agentType].name;

    payments.push({
      id: nextId(),
      from: 'user',
      to,
      amount,
      timestamp: Date.now(),
    });

    if (agentType === 'platform') {
      events.push({
        id: nextId(),
        type: 'platform_fee',
        timestamp: Date.now(),
        data: { from: 'You', to: agentName, amount, asset: 'USDC', feePercentage: PLATFORM_CONFIG.FEE_PERCENTAGE, success: true },
      });
    } else {
      events.push({
        id: nextId(),
        type: 'payment',
        timestamp: Date.now(),
        data: { from: 'You', to: agentName, amount, asset: 'USDC', success: true },
      });
    }
  }

  // ========== 1. Moderator Introduction ==========
  emitStep('moderator_intro', 0, 'moderator', 'started');
  const modResult = await moderate(state.topic);
  if (!modResult.success) throw new Error(`Moderator failed: ${modResult.error}`);
  addContribution('moderator', modResult.content, 0);
  emitStep('moderator_intro', 0, 'moderator', 'completed');
  addPayment('moderator', DEBATE_PRICING.moderator.basePrice);

  // ========== 2. Debate Rounds ==========
  let totalRounds = MIN_ROUNDS;

  for (let round = 1; round <= totalRounds; round++) {
    state.currentRound = round;

    // Round marker event
    events.push({
      id: nextId(),
      type: 'round_marker',
      timestamp: Date.now(),
      data: { round, totalRounds },
    });

    // Debater A
    emitStep('debater_a', round, 'debater_a', 'started');
    const proResult = await argueFor(state.topic, state);
    if (!proResult.success) throw new Error(`Debater A failed: ${proResult.error}`);
    addContribution('debater_a', proResult.content, round);
    emitStep('debater_a', round, 'debater_a', 'completed');
    addPayment('debater_a', DEBATE_PRICING.debater_a.basePrice);

    // Debater B
    emitStep('debater_b', round, 'debater_b', 'started');
    const conResult = await argueCon(state.topic, state);
    if (!conResult.success) throw new Error(`Debater B failed: ${conResult.error}`);
    addContribution('debater_b', conResult.content, round);
    emitStep('debater_b', round, 'debater_b', 'completed');
    addPayment('debater_b', DEBATE_PRICING.debater_b.basePrice);

    // Fact Checker
    emitStep('fact_check', round, 'fact_checker', 'started');
    const fcResult = await checkFacts(state);
    if (!fcResult.success) throw new Error(`Fact Checker failed: ${fcResult.error}`);
    addContribution('fact_checker', fcResult.content, round, undefined, fcResult.factCheckResult);
    emitStep('fact_check', round, 'fact_checker', 'completed');
    addPayment('fact_checker', DEBATE_PRICING.fact_checker.basePrice);

    // Judge scoring
    emitStep('judge_score', round, 'judge', 'started');
    const judgeResult = await scoreRound(state);
    state.scores.push(judgeResult.score);
    addContribution('judge', judgeResult.content, round, judgeResult.score);
    emitStep('judge_score', round, 'judge', 'completed');
    addPayment('judge', DEBATE_PRICING.judge.basePrice);

    // Build round record
    const roundContribs = state.contributions.filter(c => c.round === round);
    rounds.push({
      number: round,
      proArgument: roundContribs.find(c => c.role === 'debater_a')?.content || '',
      conArgument: roundContribs.find(c => c.role === 'debater_b')?.content || '',
      factCheck: fcResult.factCheckResult || { claims: [], overallAssessment: fcResult.content },
      score: judgeResult.score,
    });

    // After round 2, check if we need round 3
    if (round === MIN_ROUNDS && judgeResult.score.needsMoreRounds && totalRounds < MAX_ROUNDS) {
      totalRounds = MAX_ROUNDS;
    }
  }

  // ========== 3. Judge Verdict ==========
  emitStep('judge_verdict', 0, 'judge', 'started');
  const verdictResult = await deliverVerdict(state);
  if (!verdictResult.success) throw new Error(`Judge verdict failed: ${verdictResult.error}`);
  addContribution('judge', verdictResult.content, 0);
  emitStep('judge_verdict', 0, 'judge', 'completed');
  addPayment('judge_verdict', DEBATE_PRICING.judge_verdict.basePrice);

  // ========== 4. Summarizer ==========
  emitStep('summary', 0, 'summarizer', 'started');
  const summaryResult = await summarize(state);
  if (!summaryResult.success) throw new Error(`Summarizer failed: ${summaryResult.error}`);
  addContribution('summarizer', summaryResult.content, 0);
  emitStep('summary', 0, 'summarizer', 'completed');
  addPayment('summarizer', DEBATE_PRICING.summarizer.basePrice);

  // ========== 5. Platform Fee ==========
  const costBreakdown = estimateDebateCost(totalRounds);
  addPayment('platform', costBreakdown.platformFee);

  // Determine winner
  const totalPro = state.scores.reduce((s, r) => s + r.proScore, 0);
  const totalCon = state.scores.reduce((s, r) => s + r.conScore, 0);
  const winner: 'pro' | 'con' | 'tie' = totalPro > totalCon ? 'pro' : totalCon > totalPro ? 'con' : 'tie';

  state.isComplete = true;

  const transcript: DebateTranscript = {
    topic: state.topic,
    rounds,
    verdict: verdictResult.content,
    summary: summaryResult.content,
    winner,
    totalRounds,
  };

  return {
    debate: transcript,
    payments,
    events,
    costBreakdown,
  };
}
