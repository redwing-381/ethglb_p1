/**
 * useLiFiBridge Hook
 * 
 * React hook for LI.FI cross-chain bridge functionality.
 * Handles quote fetching, token approval, bridge execution, and status tracking.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import type { LiFiQuote, StatusResponse, QuoteParams } from '@/types/lifi';
import { getQuote, getStatus } from '@/lib/blockchain';

/**
 * Hook return type
 */
export interface UseLiFiBridgeReturn {
  // Quote operations
  fetchQuote: (params: Omit<QuoteParams, 'fromAddress'>) => Promise<LiFiQuote | null>;
  quote: LiFiQuote | null;
  quoteLoading: boolean;
  quoteError: string | null;
  
  // Approval operations
  checkApproval: (quote: LiFiQuote) => Promise<boolean>;
  executeApproval: (quote: LiFiQuote) => Promise<string | null>;
  approvalLoading: boolean;
  approvalError: string | null;
  
  // Bridge execution
  executeBridge: (quote: LiFiQuote) => Promise<string | null>;
  bridgeLoading: boolean;
  bridgeError: string | null;
  
  // Status tracking
  trackStatus: (txHash: string, fromChain: number, toChain: number) => Promise<StatusResponse | null>;
  pollStatus: (
    txHash: string,
    fromChain: number,
    toChain: number,
    onUpdate: (status: StatusResponse) => void
  ) => () => void;
  statusData: StatusResponse | null;
  statusError: string | null;
  
  // Clear functions
  clearQuote: () => void;
  clearErrors: () => void;
}

/**
 * Debounce delay for quote requests (milliseconds)
 */
const QUOTE_DEBOUNCE_MS = 500;

/**
 * Status polling interval (milliseconds)
 */
const STATUS_POLL_INTERVAL_MS = 5000;

/**
 * Custom hook for LI.FI bridge operations
 */
export function useLiFiBridge(): UseLiFiBridgeReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  // Quote state
  const [quote, setQuote] = useState<LiFiQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  
  // Approval state
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  
  // Bridge state
  const [bridgeLoading, setBridgeLoading] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  
  // Status state
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  
  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * Fetch a bridge quote with debouncing
   */
  const fetchQuote = useCallback(
    async (params: Omit<QuoteParams, 'fromAddress'>): Promise<LiFiQuote | null> => {
      if (!address) {
        setQuoteError('Wallet not connected');
        return null;
      }
      
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set loading state immediately
      setQuoteLoading(true);
      setQuoteError(null);
      
      return new Promise((resolve) => {
        debounceTimerRef.current = setTimeout(async () => {
          try {
            const quoteParams: QuoteParams = {
              ...params,
              fromAddress: address,
              integrator: 'agentpay',
              slippage: params.slippage || 0.005, // Default 0.5%
            };
            
            const result = await getQuote(quoteParams);
            setQuote(result);
            setQuoteLoading(false);
            resolve(result);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch quote';
            
            // Handle specific error cases
            if (errorMessage.includes('NO_POSSIBLE_ROUTE')) {
              setQuoteError('No bridge route available for this amount. Try a different amount or token.');
            } else if (errorMessage.includes('AMOUNT_TOO_LOW')) {
              setQuoteError('Amount below minimum. Please increase the amount.');
            } else if (errorMessage.includes('AMOUNT_TOO_HIGH')) {
              setQuoteError('Amount exceeds maximum. Please reduce the amount.');
            } else {
              setQuoteError(errorMessage);
            }
            
            setQuoteLoading(false);
            setQuote(null);
            resolve(null);
          }
        }, QUOTE_DEBOUNCE_MS);
      });
    },
    [address]
  );
  
  /**
   * Check if token approval is needed
   */
  const checkApproval = useCallback(
    async (quote: LiFiQuote): Promise<boolean> => {
      if (!publicClient || !address) {
        return false;
      }
      
      try {
        const tokenAddress = quote.action.fromToken.address;
        const spenderAddress = quote.estimate.approvalAddress;
        const requiredAmount = BigInt(quote.action.fromAmount);
        
        // Native token (ETH, MATIC, etc.) doesn't need approval
        if (tokenAddress === '0x0000000000000000000000000000000000000000') {
          return false;
        }
        
        // Check current allowance
        const allowance = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address as `0x${string}`, spenderAddress as `0x${string}`],
        });
        
        // Return true if approval is needed
        return allowance < requiredAmount;
      } catch (error) {
        console.error('Error checking approval:', error);
        return true; // Assume approval needed on error
      }
    },
    [publicClient, address]
  );
  
  /**
   * Execute token approval
   */
  const executeApproval = useCallback(
    async (quote: LiFiQuote): Promise<string | null> => {
      if (!walletClient || !address) {
        setApprovalError('Wallet not connected');
        return null;
      }
      
      setApprovalLoading(true);
      setApprovalError(null);
      
      try {
        const tokenAddress = quote.action.fromToken.address;
        const spenderAddress = quote.estimate.approvalAddress;
        const amount = BigInt(quote.action.fromAmount);
        
        // Request approval transaction
        const hash = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spenderAddress as `0x${string}`, amount],
        });
        
        // Wait for confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        
        setApprovalLoading(false);
        return hash;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Approval failed';
        
        if (errorMessage.includes('User rejected')) {
          setApprovalError('Approval cancelled');
        } else {
          setApprovalError(errorMessage);
        }
        
        setApprovalLoading(false);
        return null;
      }
    },
    [walletClient, publicClient, address]
  );
  
  /**
   * Execute bridge transaction
   */
  const executeBridge = useCallback(
    async (quote: LiFiQuote): Promise<string | null> => {
      if (!walletClient || !address) {
        setBridgeError('Wallet not connected');
        return null;
      }
      
      setBridgeLoading(true);
      setBridgeError(null);
      
      try {
        const txRequest = quote.transactionRequest;
        
        // Send transaction
        const hash = await walletClient.sendTransaction({
          to: txRequest.to as `0x${string}`,
          data: txRequest.data as `0x${string}`,
          value: BigInt(txRequest.value),
          gas: BigInt(txRequest.gasLimit),
          ...(txRequest.gasPrice && { gasPrice: BigInt(txRequest.gasPrice) }),
        });
        
        setBridgeLoading(false);
        return hash;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Bridge transaction failed';
        
        if (errorMessage.includes('User rejected')) {
          setBridgeError('Bridge cancelled');
        } else {
          setBridgeError(errorMessage);
        }
        
        setBridgeLoading(false);
        return null;
      }
    },
    [walletClient, address]
  );
  
  /**
   * Track transaction status (single check)
   */
  const trackStatus = useCallback(
    async (txHash: string, fromChain: number, toChain: number): Promise<StatusResponse | null> => {
      setStatusError(null);
      
      try {
        const status = await getStatus({
          txHash,
          fromChain,
          toChain,
        });
        
        setStatusData(status);
        return status;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch status';
        setStatusError(errorMessage);
        return null;
      }
    },
    []
  );
  
  /**
   * Poll transaction status until completion
   */
  const pollStatus = useCallback(
    (
      txHash: string,
      fromChain: number,
      toChain: number,
      onUpdate: (status: StatusResponse) => void
    ): (() => void) => {
      let intervalId: NodeJS.Timeout | null = null;
      let isCancelled = false;
      
      const poll = async () => {
        if (isCancelled) return;
        
        try {
          const status = await getStatus({
            txHash,
            fromChain,
            toChain,
          });
          
          if (!isCancelled) {
            setStatusData(status);
            onUpdate(status);
            
            // Stop polling if done or failed
            if (status.status === 'DONE' || status.status === 'FAILED') {
              if (intervalId) {
                clearInterval(intervalId);
              }
            }
          }
        } catch (error) {
          if (!isCancelled) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch status';
            setStatusError(errorMessage);
          }
        }
      };
      
      // Start polling
      poll(); // Initial check
      intervalId = setInterval(poll, STATUS_POLL_INTERVAL_MS);
      
      // Return cleanup function
      return () => {
        isCancelled = true;
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    },
    []
  );
  
  /**
   * Clear quote data
   */
  const clearQuote = useCallback(() => {
    setQuote(null);
    setQuoteError(null);
  }, []);
  
  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setQuoteError(null);
    setApprovalError(null);
    setBridgeError(null);
    setStatusError(null);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  return {
    // Quote
    fetchQuote,
    quote,
    quoteLoading,
    quoteError,
    
    // Approval
    checkApproval,
    executeApproval,
    approvalLoading,
    approvalError,
    
    // Bridge
    executeBridge,
    bridgeLoading,
    bridgeError,
    
    // Status
    trackStatus,
    pollStatus,
    statusData,
    statusError,
    
    // Utilities
    clearQuote,
    clearErrors,
  };
}
