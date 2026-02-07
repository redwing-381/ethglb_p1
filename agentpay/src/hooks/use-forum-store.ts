/**
 * React hook for the forum store — subscribes to changes and provides reactive posts.
 */

'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { getPosts, subscribe, addPost as storeAddPost, clearPosts as storeClearPosts } from '@/lib/forum/store';
import type { ForumPost } from '@/types';

export function useForumStore() {
  const posts = useSyncExternalStore(subscribe, getPosts, getPosts);

  const addPost = useCallback((post: ForumPost) => storeAddPost(post), []);
  const clearPosts = useCallback(() => storeClearPosts(), []);

  return { posts, addPost, clearPosts };
}
