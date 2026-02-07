/**
 * Custom hook for reading multiple ENS text records
 * 
 * Reads the standard AgentPay text record keys for a given ENS name
 * on Sepolia testnet, with caching support.
 */

'use client';

import { useEnsText } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getCachedTextRecord, setCachedTextRecord } from '@/lib/blockchain';
import { useEffect, useMemo } from 'react';
import type { EnsTextRecords } from '@/types';

export interface UseEnsTextRecordsResult {
  records: EnsTextRecords;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Reads ENS text records for an agent subname on Sepolia.
 * Checks cache before querying on-chain, caches results on resolution.
 */
export function useEnsTextRecords(name: string | undefined): UseEnsTextRecordsResult {
  const enabled = !!name;

  // Check cache for each key
  const cachedDescription = name ? getCachedTextRecord(name, 'description') : undefined;
  const cachedRole = name ? getCachedTextRecord(name, 'org.agentpay.role') : undefined;
  const cachedModel = name ? getCachedTextRecord(name, 'org.agentpay.model') : undefined;
  const cachedPrice = name ? getCachedTextRecord(name, 'org.agentpay.price') : undefined;
  const cachedAvatar = name ? getCachedTextRecord(name, 'avatar') : undefined;

  // Individual useEnsText calls (wagmi requires one per key)
  const description = useEnsText({
    name: name,
    key: 'description',
    chainId: sepolia.id,
    query: { enabled: enabled && cachedDescription === undefined },
  });

  const role = useEnsText({
    name: name,
    key: 'org.agentpay.role',
    chainId: sepolia.id,
    query: { enabled: enabled && cachedRole === undefined },
  });

  const model = useEnsText({
    name: name,
    key: 'org.agentpay.model',
    chainId: sepolia.id,
    query: { enabled: enabled && cachedModel === undefined },
  });

  const price = useEnsText({
    name: name,
    key: 'org.agentpay.price',
    chainId: sepolia.id,
    query: { enabled: enabled && cachedPrice === undefined },
  });

  const avatar = useEnsText({
    name: name,
    key: 'avatar',
    chainId: sepolia.id,
    query: { enabled: enabled && cachedAvatar === undefined },
  });

  // Cache results when they resolve
  useEffect(() => {
    if (!name) return;
    if (description.data !== undefined && cachedDescription === undefined) {
      setCachedTextRecord(name, 'description', description.data ?? null);
    }
  }, [name, description.data, cachedDescription]);

  useEffect(() => {
    if (!name) return;
    if (role.data !== undefined && cachedRole === undefined) {
      setCachedTextRecord(name, 'org.agentpay.role', role.data ?? null);
    }
  }, [name, role.data, cachedRole]);

  useEffect(() => {
    if (!name) return;
    if (model.data !== undefined && cachedModel === undefined) {
      setCachedTextRecord(name, 'org.agentpay.model', model.data ?? null);
    }
  }, [name, model.data, cachedModel]);

  useEffect(() => {
    if (!name) return;
    if (price.data !== undefined && cachedPrice === undefined) {
      setCachedTextRecord(name, 'org.agentpay.price', price.data ?? null);
    }
  }, [name, price.data, cachedPrice]);

  useEffect(() => {
    if (!name) return;
    if (avatar.data !== undefined && cachedAvatar === undefined) {
      setCachedTextRecord(name, 'avatar', avatar.data ?? null);
    }
  }, [name, avatar.data, cachedAvatar]);

  const records: EnsTextRecords = useMemo(() => ({
    description: cachedDescription !== undefined ? cachedDescription : (description.data ?? null),
    role: cachedRole !== undefined ? cachedRole : (role.data ?? null),
    model: cachedModel !== undefined ? cachedModel : (model.data ?? null),
    price: cachedPrice !== undefined ? cachedPrice : (price.data ?? null),
    avatar: cachedAvatar !== undefined ? cachedAvatar : (avatar.data ?? null),
  }), [
    cachedDescription, cachedRole, cachedModel, cachedPrice, cachedAvatar,
    description.data, role.data, model.data, price.data, avatar.data,
  ]);

  const isLoading = description.isLoading || role.isLoading || model.isLoading || price.isLoading || avatar.isLoading;
  const error = (description.error || role.error || model.error || price.error || avatar.error) as Error | null;

  return { records, isLoading, error };
}
