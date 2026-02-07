/**
 * Custom hook for ENS forward resolution (name → address)
 * 
 * Wraps wagmi's useEnsAddress with custom caching and validation logic.
 * Validates ENS name format before resolution.
 */

import { useEnsAddress as useWagmiEnsAddress } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { 
  getCachedForwardResolution, 
  setCachedForwardResolution,
  isValidEnsName 
} from '@/lib/blockchain';
import { useEffect, useState } from 'react';
import { isAddress } from 'viem';

export interface UseEnsAddressResult {
  address: string | null;
  isLoading: boolean;
  error: Error | null;
  isValid: boolean; // Whether the resolved address is valid
}

/**
 * Resolves an ENS name to its Ethereum address
 * 
 * Features:
 * - Validates ENS name format before resolution
 * - Checks cache before blockchain query
 * - Validates resolved address format
 * - Caches successful resolutions
 * - Handles loading and error states gracefully
 * 
 * @param ensName - ENS name to resolve (e.g., 'vitalik.eth')
 * @returns Resolved address, loading state, error, and validity flag
 * 
 * @example
 * const { address, isLoading, isValid } = useEnsAddress('vitalik.eth');
 * // address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' or null
 * // isValid: true if address is valid Ethereum address
 */
export function useEnsAddress(ensName: string | undefined): UseEnsAddressResult {
  const [cachedAddress, setCachedAddress] = useState<string | null | undefined>(undefined);
  const [validationError, setValidationError] = useState<Error | null>(null);
  
  // Validate ENS name format
  const isValidFormat = ensName ? isValidEnsName(ensName) : false;
  
  // Check cache first
  useEffect(() => {
    if (ensName && isValidFormat) {
      const cached = getCachedForwardResolution(ensName);
      if (cached !== undefined) {
        setCachedAddress(cached);
      } else {
        setCachedAddress(undefined);
      }
      setValidationError(null);
    } else if (ensName && !isValidFormat) {
      setValidationError(new Error('Please enter a valid ENS name (e.g., name.eth)'));
      setCachedAddress(null);
    }
  }, [ensName, isValidFormat]);
  
  // Use wagmi's ENS hook (only queries if not cached and valid format)
  const { 
    data: wagmiAddress, 
    isLoading: wagmiLoading, 
    error: wagmiError 
  } = useWagmiEnsAddress({
    name: ensName,
    chainId: sepolia.id,
    query: {
      enabled: !!ensName && isValidFormat && cachedAddress === undefined,
    },
  });
  
  // Cache the result from wagmi
  useEffect(() => {
    if (ensName && wagmiAddress !== undefined && cachedAddress === undefined) {
      setCachedForwardResolution(ensName, wagmiAddress);
      setCachedAddress(wagmiAddress);
    }
  }, [ensName, wagmiAddress, cachedAddress]);
  
  // Determine final values
  const address = cachedAddress !== undefined ? cachedAddress : wagmiAddress ?? null;
  const isLoading = cachedAddress === undefined && wagmiLoading && isValidFormat;
  const error = validationError || (wagmiError as Error | null);
  
  // Validate resolved address
  const isValid = address ? isAddress(address) : false;
  
  return {
    address,
    isLoading,
    error,
    isValid,
  };
}
