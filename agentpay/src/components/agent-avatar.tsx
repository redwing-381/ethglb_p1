/**
 * Agent Avatar Component
 * 
 * Displays an agent's avatar from ENS on-chain records.
 * Falls back to lucide icon when no avatar URL is available.
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Mic, Shield, Sword, Search, Scale, FileText, Landmark, Bot
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  mic: Mic,
  shield: Shield,
  sword: Sword,
  search: Search,
  scale: Scale,
  'file-text': FileText,
  landmark: Landmark,
};

interface AgentAvatarProps {
  avatar: string | null;
  icon: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

const iconSizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4.5 h-4.5',
  lg: 'w-5 h-5',
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

  const IconComponent = ICON_MAP[icon] || Bot;

  return (
    <span className={cn(
      'flex items-center justify-center flex-shrink-0 rounded-full bg-primary/10 text-primary',
      sizeClasses[size], className
    )}>
      <IconComponent className={iconSizeClasses[size]} />
    </span>
  );
}

/** Standalone helper to render an agent icon from a string name */
export function AgentIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = ICON_MAP[icon] || Bot;
  return <IconComponent className={cn('w-4 h-4', className)} />;
}
