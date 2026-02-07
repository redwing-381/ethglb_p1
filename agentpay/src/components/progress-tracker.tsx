/**
 * Progress Tracker Component
 * 
 * Shows task execution progress across multiple agents
 */

import { LoadingSpinner } from './loading-spinner';
import { cn } from '@/lib/utils';

interface ProgressTrackerProps {
  totalSteps: number;
  currentStep: number;
  currentAgent?: string;
  isComplete: boolean;
  className?: string;
}

export function ProgressTracker({
  totalSteps,
  currentStep,
  currentAgent,
  isComplete,
  className,
}: ProgressTrackerProps) {
  const percentage = Math.min(100, Math.round((currentStep / totalSteps) * 100));

  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            'h-2 rounded-full transition-all duration-300',
            isComplete ? 'bg-green-500' : 'bg-blue-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Status text */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {isComplete ? (
            <span className="text-green-600 flex items-center gap-1 font-medium">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Complete
            </span>
          ) : (
            `${currentStep}/${totalSteps} agents complete`
          )}
        </span>

        {currentAgent && !isComplete && (
          <span className="text-muted-foreground flex items-center gap-1">
            <LoadingSpinner size="sm" className="text-blue-500" />
            {currentAgent}
          </span>
        )}
      </div>
    </div>
  );
}
