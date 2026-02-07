/**
 * ENS Badge Component
 * 
 * Visual indicator for ENS name resolution
 */

import { cn } from '@/lib/utils';

interface EnsBadgeProps {
  className?: string;
}

export function EnsBadge({ className }: EnsBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'bg-blue-500/15 text-blue-400 text-xs font-medium',
        className
      )}
    >
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ENS logo - simplified version */}
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.82 8 12 11.82 4.18 8 12 4.18zM4 9.47l7 3.5v7.85l-7-3.5V9.47zm9 11.35v-7.85l7-3.5v7.85l-7 3.5z" />
      </svg>
      ENS
    </span>
  );
}
