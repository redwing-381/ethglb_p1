/**
 * Agent Earnings Component
 * 
 * Tracks and displays accumulated off-chain earnings per agent.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AnimatedCard } from '@/components/ui/animated-card';
import { AnimatedList } from '@/components/ui/animated-list';
import { BorderBeam } from '@/components/ui/border-beam';
import { Bot } from 'lucide-react';

export interface AgentEarning {
  name: string;
  address: string;
  earned: string;
  icon: string;
}

export type AgentEarningsMap = Record<string, AgentEarning>;

interface AgentEarningsProps {
  earnings: AgentEarningsMap;
}

export function AgentEarnings({ earnings }: AgentEarningsProps) {
  const entries = Object.values(earnings);
  const totalEarned = entries.reduce((sum, e) => sum + parseFloat(e.earned), 0).toFixed(2);

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground/70 mb-3">Agent Earnings (Off-Chain)</h3>
      <AnimatedCard className="relative overflow-hidden">
        {entries.length > 0 && <BorderBeam lightColor="#10B981" lightWidth={180} duration={8} borderWidth={1.5} />}
        <Card className="border-0 shadow-none">
        <CardContent className="p-4 space-y-3">
          <AnimatedList className="flex-col space-y-3">
            {entries.map((entry) => (
              <div key={entry.address} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{entry.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-green-600">+{entry.earned} USDC</span>
              </div>
            ))}
          </AnimatedList>
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total distributed</span>
            <span className="text-sm font-bold text-foreground">{totalEarned} USDC</span>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Earnings accumulate on Yellow Network&apos;s unified balance. Agents can withdraw independently.
          </p>
        </CardContent>
        </Card>
      </AnimatedCard>
    </div>
  );
}
