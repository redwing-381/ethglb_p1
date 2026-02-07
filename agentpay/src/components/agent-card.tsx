/**
 * Agent Card Component
 * 
 * Displays agent information with ENS name resolution and pricing.
 * Shows ENS name when available, or descriptive label as fallback.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useEnsName } from '@/hooks/use-ens-name';
import { EnsBadge } from '@/components/ens-badge';
import { formatUSDC } from '@/lib/utils';

interface AgentCardProps {
  name: string;
  address: string;
  description: string;
  icon?: string;
  basePrice?: string;
}

/**
 * Agent card with ENS name display and pricing
 * 
 * Features:
 * - Resolves agent address to ENS name
 * - Falls back to descriptive label if no ENS name
 * - Shows full address on hover
 * - Displays agent icon, description, and base price
 */
export function AgentCard({ name, address, description, icon = '🤖', basePrice }: AgentCardProps) {
  const { displayName, ensName } = useEnsName(address);
  
  const isFree = basePrice && parseFloat(basePrice) === 0;
  
  return (
    <Card className="hover:border-gray-300 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm text-gray-900">{name}</h4>
                {ensName && <EnsBadge />}
              </div>
              {basePrice !== undefined && (
                <span className={`text-xs font-medium ${isFree ? 'text-green-600' : 'text-gray-600'}`}>
                  {isFree ? 'Free' : formatUSDC(basePrice)}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
