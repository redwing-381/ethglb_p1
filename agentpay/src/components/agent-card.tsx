/**
 * Agent Card Component
 * 
 * Displays agent information with ENS name resolution.
 * Shows ENS name when available, or descriptive label as fallback.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useEnsName } from '@/hooks/use-ens-name';
import { EnsBadge } from '@/components/ens-badge';

interface AgentCardProps {
  name: string;
  address: string;
  description: string;
  icon?: string;
}

/**
 * Agent card with ENS name display
 * 
 * Features:
 * - Resolves agent address to ENS name
 * - Falls back to descriptive label if no ENS name
 * - Shows full address on hover
 * - Displays agent icon and description
 */
export function AgentCard({ name, address, description, icon = '🤖' }: AgentCardProps) {
  const { displayName, ensName } = useEnsName(address);
  
  return (
    <Card className="hover:border-gray-300 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm text-gray-900">{name}</h4>
              {ensName && <EnsBadge />}
            </div>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
