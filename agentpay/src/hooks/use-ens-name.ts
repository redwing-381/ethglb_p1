/**
 * Custom hook for ENS reverse resolution (address → name)
 * 
 * Wraps wagmi's useEnsName with custom caching and fallback logic.
 * Returns ENS name when available, or truncated address as fallback.
 */

import { useEnsName as useWagmiEnsName } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { 
  getCachedReverseResolution, 
  setCachedReverseResolution,
  truncateAddress 
} from '@/lib/blockchain';
import { useEffect, useState } from 'react';

export interface UseEnsNameResult {
  ensName: string | null;
  displayName: string; // ENS name or truncated address (never null)
  isLoading: boolean;
  error: Error | null;
}

/**
 * Resolves an Ethereum address to its primary ENS name
 * 
 * Features:
 * - Checks cache before blockchain query
 * - Returns truncated address as fallback
 * - Caches successful resolutions
 * - Handles loading and error states gracefully
 * 
 * @param address - Ethereum address to resolve
 * @returns ENS name, display name, loading state, and error
 * 
 * @example
 * const { ensName, displayName, isLoading } = useEnsName('0x1234...');
 * // ensName: 'vitalik.eth' or null
 * // displayName: 'vitalik.eth' or '0x1234...5678'
 */
export function useEnsName(address: string | undefined): UseEnsNameResult {
  const [cachedName, setCachedName] = useState<string | null | undefined>(undefined);
  
  // Check cache first
  useEffect(() => {
    if (address) {
      const cached = getCachedReverseResolution(address);
      if (cached !== undefined) {
        setCachedName(cached);
      } else {
        setCachedName(undefined);
      }
    }
  }, [address]);
  
  // Use wagmi's ENS hook (only queries if not cached)
  const { 
    data: wagmiName, 
    isLoading: wagmiLoading, 
    error: wagmiError 
  } = useWagmiEnsName({
    address: address as `0x${string}` | undefined,
    chainId: sepolia.id,
    query: {
      enabled: !!address && cachedName === undefined,
    },
  });
  
  // Cache the result from wagmi
  useEffect(() => {
    if (address && wagmiName !== undefined && cachedName === undefined) {
      setCachedReverseResolution(address, wagmiName);
      setCachedName(wagmiName);
    }
  }, [address, wagmiName, cachedName]);
  
  // Determine final values
  const ensName = cachedName !== undefined ? cachedName : wagmiName ?? null;
  const isLoading = cachedName === undefined && wagmiLoading;
  const error = wagmiError as Error | null;
  
  // Display name: ENS name if available, otherwise truncated address
  const displayName = ensName || (address ? truncateAddress(address) : '');
  
  return {
    ensName,
    displayName,
    isLoading,
    error,
  };
}
