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
    <Card className="card-hover border-gray-200 bg-white">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-100">
            <span className="text-3xl">{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-gray-900 mb-1">{name}</h3>
            <div 
              className="text-xs text-gray-500 mb-2 cursor-help flex items-center gap-2 flex-wrap" 
              title={address}
            >
              <span className="truncate font-mono">{ensName || name}</span>
              {ensName && <EnsBadge />}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
