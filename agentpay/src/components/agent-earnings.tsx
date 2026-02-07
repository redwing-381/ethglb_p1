/**
 * Agent Earnings Component
 * 
 * Tracks and displays accumulated off-chain earnings per agent.
 * Since we can't query agent unified balances from the clearnode
 * (agents haven't authenticated), we track earnings locally
 * as transfers are made.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';

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
  const totalEarned = entries
    .reduce((sum, e) => sum + parseFloat(e.earned), 0)
    .toFixed(2);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">Agent Earnings (Off-Chain)</h3>
      <Card>
        <CardContent className="p-4 space-y-3">
          {entries.map((entry) => (
            <div key={entry.address} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{entry.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{entry.name}</p>
                  <p className="text-xs text-gray-400 font-mono">
                    {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold text-green-600">
                +{entry.earned} USDC
              </span>
            </div>
          ))}
          
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">Total distributed</span>
            <span className="text-sm font-bold text-gray-900">{totalEarned} USDC</span>
          </div>
          
          <p className="text-xs text-gray-400">
            Earnings accumulate on Yellow Network's unified balance. Agents can withdraw independently.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
