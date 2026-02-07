/**
 * ENS (Ethereum Name Service) Utility Functions
 * 
 * This module provides core ENS resolution utilities including:
 * - Address truncation for display
 * - ENS name validation
 * - Caching layer with 5-minute TTL
 * - Cache management for forward and reverse resolution
 */

// Cache entry structure with timestamp for TTL management
interface EnsCacheEntry {
  value: string | null;
  timestamp: number;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Separate caches for forward (name → address), reverse (address → name), and text records
const forwardCache = new Map<string, EnsCacheEntry>();
const reverseCache = new Map<string, EnsCacheEntry>();
const textRecordCache = new Map<string, EnsCacheEntry>();

/**
 * Truncates an Ethereum address to format: 0xAAAA...ZZZZ
 * 
 * @param address - Full Ethereum address (0x + 40 hex chars)
 * @returns Truncated address showing first 4 and last 4 characters
 * 
 * @example
 * truncateAddress('0x1234567890123456789012345678901234567890')
 * // Returns: '0x1234...7890'
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) {
    return address;
  }
  
  // Format: 0x + first 4 chars + ... + last 4 chars
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Validates ENS name format
 * 
 * Valid ENS names must:
 * - Contain at least one dot (TLD required)
 * - Have supported TLD (.eth, .xyz, etc.)
 * - Not be empty
 * 
 * @param name - ENS name to validate
 * @returns true if valid ENS name format
 * 
 * @example
 * isValidEnsName('vitalik.eth') // true
 * isValidEnsName('test.xyz') // true
 * isValidEnsName('invalid') // false (no TLD)
 * isValidEnsName('') // false (empty)
 */
export function isValidEnsName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // Must contain at least one dot (TLD required)
  if (!name.includes('.')) {
    return false;
  }
  
  // Basic format validation (alphanumeric, hyphens, dots)
  const ensNamePattern = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
  return ensNamePattern.test(name);
}

/**
 * Checks if a cache entry is still fresh (within TTL)
 * 
 * @param entry - Cache entry with timestamp
 * @returns true if entry is within TTL period
 */
export function isCacheEntryFresh(entry: EnsCacheEntry): boolean {
  const now = Date.now();
  return (now - entry.timestamp) < CACHE_TTL;
}

/**
 * Gets cached forward resolution (name → address)
 * 
 * @param name - ENS name to lookup
 * @returns Cached address, null if not found, or undefined if not cached/stale
 */
export function getCachedForwardResolution(name: string): string | null | undefined {
  const entry = forwardCache.get(name.toLowerCase());
  
  if (!entry) {
    return undefined; // Not cached
  }
  
  if (!isCacheEntryFresh(entry)) {
    forwardCache.delete(name.toLowerCase());
    return undefined; // Stale, removed from cache
  }
  
  return entry.value;
}

/**
 * Stores forward resolution in cache (name → address)
 * 
 * @param name - ENS name
 * @param address - Resolved Ethereum address (or null if not found)
 */
export function setCachedForwardResolution(name: string, address: string | null): void {
  forwardCache.set(name.toLowerCase(), {
    value: address,
    timestamp: Date.now(),
  });
}

/**
 * Gets cached reverse resolution (address → name)
 * 
 * @param address - Ethereum address to lookup
 * @returns Cached ENS name, null if not found, or undefined if not cached/stale
 */
export function getCachedReverseResolution(address: string): string | null | undefined {
  const entry = reverseCache.get(address.toLowerCase());
  
  if (!entry) {
    return undefined; // Not cached
  }
  
  if (!isCacheEntryFresh(entry)) {
    reverseCache.delete(address.toLowerCase());
    return undefined; // Stale, removed from cache
  }
  
  return entry.value;
}

/**
 * Stores reverse resolution in cache (address → name)
 * 
 * @param address - Ethereum address
 * @param name - Resolved ENS name (or null if not found)
 */
export function setCachedReverseResolution(address: string, name: string | null): void {
  reverseCache.set(address.toLowerCase(), {
    value: name,
    timestamp: Date.now(),
  });
}

/**
 * Clears all cached ENS resolutions
 * 
 * Should be called when:
 * - User disconnects wallet
 * - Network switches
 * - Manual cache invalidation needed
 */
export function clearEnsCache(): void {
  forwardCache.clear();
  reverseCache.clear();
  textRecordCache.clear();
}

/**
 * Gets cache statistics for debugging
 * 
 * @returns Object with cache sizes and entry counts
 */
export function getCacheStats() {
  return {
    forwardCacheSize: forwardCache.size,
    reverseCacheSize: reverseCache.size,
    textRecordCacheSize: textRecordCache.size,
    totalEntries: forwardCache.size + reverseCache.size + textRecordCache.size,
  };
}

/**
 * Gets cached text record value for an ENS name + key pair
 * 
 * @param name - ENS name
 * @param key - Text record key (e.g., 'org.agentpay.role')
 * @returns Cached value, null if resolved to nothing, or undefined if not cached/stale
 */
export function getCachedTextRecord(name: string, key: string): string | null | undefined {
  const cacheKey = `${name.toLowerCase()}:${key}`;
  const entry = textRecordCache.get(cacheKey);
  
  if (!entry) return undefined;
  
  if (!isCacheEntryFresh(entry)) {
    textRecordCache.delete(cacheKey);
    return undefined;
  }
  
  return entry.value;
}

/**
 * Stores a text record value in cache
 * 
 * @param name - ENS name
 * @param key - Text record key
 * @param value - Resolved value (or null if not found)
 */
export function setCachedTextRecord(name: string, key: string, value: string | null): void {
  const cacheKey = `${name.toLowerCase()}:${key}`;
  textRecordCache.set(cacheKey, {
    value,
    timestamp: Date.now(),
  });
}
