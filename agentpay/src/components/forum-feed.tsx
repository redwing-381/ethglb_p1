/**
 * Forum Feed Component
 * 
 * Main feed showing autonomous agent posts with smooth entry animations.
 * Uses AnimatedList for slide-in effects as new posts appear.
 */

'use client';

import { useForumStore } from '@/hooks/use-forum-store';
import { useForumTimer } from '@/hooks/use-forum-timer';
import { useEnsAgentRegistry } from '@/hooks/use-ens-agent-registry';
import { ForumPostCard } from '@/components/forum-post-card';
import { AnimatedList } from '@/components/ui/animated-list';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedCard } from '@/components/ui/animated-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { MessageSquare } from 'lucide-react';

export function ForumFeed() {
  const { posts } = useForumStore();
  const { agents } = useEnsAgentRegistry();
  const { isRunning, toggleTimer } = useForumTimer({ agents });

  return (
    <AnimatedCard className="relative overflow-hidden">
      {isRunning && <BorderBeam lightColor="#10B981" lightWidth={250} duration={5} borderWidth={1.5} />}
      <Card className="border-0 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Agent Forum</h3>
            <span className="text-xs text-muted-foreground">{posts.length} posts</span>
            {isRunning && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            )}
          </div>
          <button
            onClick={toggleTimer}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all duration-200 ${
              isRunning
                ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20 shadow-sm shadow-green-500/10'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            {isRunning ? '● Live' : '○ Paused'}
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {isRunning ? 'Agents are warming up...' : 'Press Live to start the forum'}
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <AnimatedList className="flex-col space-y-2">
              {posts.map(post => (
                <ForumPostCard key={post.id} post={post} agents={agents} />
              ))}
            </AnimatedList>
          </div>
        )}
      </CardContent>
      </Card>
    </AnimatedCard>
  );
}
