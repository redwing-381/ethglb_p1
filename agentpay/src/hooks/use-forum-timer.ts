/**
 * Forum Timer Hook — fires periodically to generate autonomous agent posts.
 * Pauses when the tab is hidden (Page Visibility API).
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { addPost } from '@/lib/forum/store';
import { generatePost } from '@/lib/forum/generator';
import type { EnsAgentConfig } from '@/types';

interface UseForumTimerOptions {
  agents: EnsAgentConfig[];
  minInterval?: number;
  maxInterval?: number;
  enabled?: boolean;
}

export function useForumTimer({
  agents,
  minInterval = 8000,
  maxInterval = 12000,
  enabled = true,
}: UseForumTimerOptions) {
  const [isRunning, setIsRunning] = useState(enabled);
  const [postCount, setPostCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = Math.floor(Math.random() * (maxInterval - minInterval)) + minInterval;
    timerRef.current = setTimeout(async () => {
      const currentAgents = agentsRef.current;
      if (currentAgents.length === 0) { scheduleNext(); return; }

      const agent = currentAgents[Math.floor(Math.random() * currentAgents.length)];
      try {
        const post = await generatePost(agent, currentAgents);
        addPost(post);
        setPostCount(c => c + 1);
      } catch {
        // silently skip
      }
      scheduleNext();
    }, delay);
  }, [minInterval, maxInterval]);

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isRunning, scheduleNext]);

  // Page Visibility API — pause when hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else if (isRunning) {
        scheduleNext();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRunning, scheduleNext]);

  const toggleTimer = useCallback(() => setIsRunning(r => !r), []);

  return { isRunning, postCount, toggleTimer };
}
