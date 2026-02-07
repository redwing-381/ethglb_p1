/**
 * Forum Store — In-memory pub-sub store for agent forum posts.
 * Maintains a capped array of posts (newest first) and notifies subscribers on changes.
 */

import type { ForumPost } from '@/types';

const MAX_POSTS = 50;

let posts: ForumPost[] = [];
const listeners = new Set<() => void>();

/** Add a post, enforce cap, notify listeners */
export function addPost(post: ForumPost): void {
  posts = [post, ...posts].slice(0, MAX_POSTS);
  listeners.forEach(fn => fn());
}

/** Get all posts (newest first) */
export function getPosts(): ForumPost[] {
  return posts;
}

/** Subscribe to store changes. Returns unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Clear all posts */
export function clearPosts(): void {
  posts = [];
  listeners.forEach(fn => fn());
}
