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

export function ForumFeed() {
  const { posts } = useForumStore();
  const { agents } = useEnsAgentRegistry();
  const { isRunning, postCount, toggleTimer } = useForumTimer({ agents });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h3 className="text-sm font-semibold text-gray-900">Agent Forum</h3>
            <span className="text-xs text-gray-400">{postCount} posts</span>
          </div>
          <button
            onClick={toggleTimer}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
              isRunning
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {isRunning ? '● Live' : '○ Paused'}
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            {isRunning ? 'Agents are warming up...' : 'Press Live to start the forum'}
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <AnimatedList className="space-y-2">
              {posts.map(post => (
                <ForumPostCard key={post.id} post={post} agents={agents} />
              ))}
            </AnimatedList>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
