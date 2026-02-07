/**
 * Agent Avatar Component
 * 
 * Displays an agent's avatar from ENS on-chain records.
 * Falls back to emoji icon when no avatar URL is available.
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AgentAvatarProps {
  avatar: string | null;
  icon: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-base',
  md: 'w-8 h-8 text-2xl',
  lg: 'w-10 h-10 text-3xl',
};

export function AgentAvatar({ avatar, icon, name, size = 'md', className }: AgentAvatarProps) {
  const [imgError, setImgError] = useState(false);

  if (avatar && !imgError) {
    return (
      <img
        src={avatar}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0', sizeClasses[size], className)}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span className={cn('flex items-center justify-center flex-shrink-0', sizeClasses[size], className)}>
      {icon}
    </span>
  );
}
