/**
 * Balance Synchronization
 * 
 * Keeps client-side balance in sync with Yellow Network.
 * Handles query failures gracefully with stale indicators.
 */

import type { YellowClient } from '../yellow/client';

/** Result of a balance sync operation */
export interface BalanceSyncResult {
  /** Current balance from Yellow Network */
  balance: string;
  /** Whether the balance may be stale (query failed) */
  isStale: boolean;
  /** Timestamp of last successful sync */
  lastSyncTime: number;
  /** Error message if sync failed */
  error?: string;
}

/**
 * Sync balance with Yellow Network.
 * 
 * Queries the current balance from Yellow Network and returns
 * the result with a stale indicator if the query fails.
 * 
 * @param yellowClient - Authenticated Yellow client
 * @returns Balance sync result
 * 
 * @example
 * ```ts
 * const result = await syncBalance(client);
 * if (result.isStale) {
 *   console.warn('Balance may be outdated');
 * }
 * console.log('Balance:', result.balance);
 * ```
 */
export async function syncBalance(
  yellowClient: YellowClient
): Promise<BalanceSyncResult> {
  try {
    const balance = await yellowClient.queryBalance();
    
    return {
      balance,
      isStale: false,
      lastSyncTime: Date.now(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Balance query failed';
    console.error('Balance sync failed:', errorMsg);
    
    return {
      balance: '0',
      isStale: true,
      lastSyncTime: 0,
      error: errorMsg,
    };
  }
}

/**
 * Format balance for display with stale indicator.
 * 
 * @param syncResult - Balance sync result
 * @returns Formatted balance string
 */
export function formatBalanceWithStatus(syncResult: BalanceSyncResult): string {
  if (syncResult.isStale) {
    return `${syncResult.balance} (stale)`;
  }
  return syncResult.balance;
}

/**
 * Check if balance sync is recent enough.
 * 
 * @param syncResult - Balance sync result
 * @param maxAgeMs - Maximum age in milliseconds (default 30 seconds)
 * @returns True if sync is recent
 */
export function isSyncRecent(
  syncResult: BalanceSyncResult,
  maxAgeMs: number = 30000
): boolean {
  if (syncResult.isStale) return false;
  return Date.now() - syncResult.lastSyncTime < maxAgeMs;
}
