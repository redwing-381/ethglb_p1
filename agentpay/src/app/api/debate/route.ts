import { NextResponse } from 'next/server';
import { runDebate, validateTopic, estimateDebateCost, validateDebateBalance } from '@/lib/debate';

export async function POST(request: Request) {
  try {
    const { topic, channelId, currentBalance } = await request.json();

    // Validate inputs
    if (!validateTopic(topic)) {
      return NextResponse.json(
        { error: 'Debate topic must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId is required' },
        { status: 400 }
      );
    }

    // Check balance against estimated cost (use max rounds for safety)
    const maxCost = estimateDebateCost(3);
    if (!validateDebateBalance(currentBalance, 3)) {
      return NextResponse.json(
        { error: `Insufficient balance. Need at least ${maxCost.totalCost} USDC` },
        { status: 400 }
      );
    }

    // Run the debate
    const result = await runDebate(topic);

    return NextResponse.json({
      status: 'complete',
      debate: result.debate,
      payments: result.payments,
      events: result.events,
      costBreakdown: result.costBreakdown,
    });
  } catch (error) {
    console.error('Debate API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Debate failed' },
      { status: 500 }
    );
  }
}
