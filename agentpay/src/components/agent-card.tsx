/**
 * Agent Card Component
 * 
 * Displays agent information with ENS name resolution.
 * Shows ENS name when available, or descriptive label as fallback.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useEnsName } from '@/hooks/use-ens-name';

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
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl flex-shrink-0">{icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1">{name}</h3>
            <p 
              className="text-sm text-gray-600 mb-2 cursor-help truncate" 
              title={address}
            >
              {ensName || displayName}
              {ensName && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  ENS
                </span>
              )}
            </p>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
