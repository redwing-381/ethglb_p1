/**
 * DepositFlow Component
 * 
 * Cross-chain deposit interface using LI.FI bridge.
 * Allows users to deposit funds from any supported blockchain to Sepolia.
 */

'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useLiFiBridge } from '@/hooks/use-lifi-bridge';
import type { LiFiQuote } from '@/types/lifi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/**
 * Supported source chains for deposits
 */
const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum', symbol: 'ETH' },
  { id: 137, name: 'Polygon', symbol: 'MATIC' },
  { id: 42161, name: 'Arbitrum', symbol: 'ETH' },
  { id: 10, name: 'Optimism', symbol: 'ETH' },
  { id: 8453, name: 'Base', symbol: 'ETH' },
];

/**
 * Target chain (Sepolia for Yellow Network)
 */
const TARGET_CHAIN_ID = 11155111;

/**
 * USDC token addresses by chain
 */
const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
};

interface DepositFlowProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function DepositFlow({ onComplete, onCancel }: DepositFlowProps) {
  const { address, chain: currentChain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // State
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'select' | 'quote' | 'approve' | 'bridge' | 'tracking'>('select');
  
  // LI.FI hook
  const {
    fetchQuote,
    quote,
    quoteLoading,
    quoteError,
    checkApproval,
    executeApproval,
    approvalLoading,
    approvalError,
    executeBridge,
    bridgeLoading,
    bridgeError,
    pollStatus,
    statusData,
    statusError,
    clearQuote,
    clearErrors,
  } = useLiFiBridge();
  
  // Get balance for selected chain
  const { data: balanceData } = useBalance({
    address,
    chainId: selectedChainId || undefined,
    ...(selectedChainId && USDC_ADDRESSES[selectedChainId] && {
      token: USDC_ADDRESSES[selectedChainId] as `0x${string}`,
    }),
  });
  
  // Initialize with current chain if supported
  useEffect(() => {
    if (currentChain && SUPPORTED_CHAINS.some(c => c.id === currentChain.id)) {
      setSelectedChainId(currentChain.id);
    }
  }, [currentChain]);
  
  /**
   * Handle chain selection
   */
  const handleChainSelect = async (chainId: number) => {
    setSelectedChainId(chainId);
    clearQuote();
    clearErrors();
    
    // Prompt chain switch if different from current
    if (currentChain?.id !== chainId && switchChain) {
      try {
        await switchChain({ chainId });
      } catch (error) {
        console.error('Chain switch failed:', error);
      }
    }
  };
  
  /**
   * Handle amount input
   */
  const handleAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      clearQuote();
    }
  };
  
  /**
   * Set max balance
   */
  const handleMaxClick = () => {
    if (balanceData) {
      setAmount(formatUnits(balanceData.value, balanceData.decimals));
    }
  };
  
  /**
   * Validate amount
   */
  const isAmountValid = (): boolean => {
    if (!amount || parseFloat(amount) <= 0) return false;
    if (!balanceData) return false;
    
    const amountBigInt = parseUnits(amount, balanceData.decimals);
    return amountBigInt <= balanceData.value;
  };
  
  /**
   * Fetch quote
   */
  const handleFetchQuote = async () => {
    if (!selectedChainId || !amount || !address) return;
    
    try {
      const amountInSmallestUnit = parseUnits(amount, 6); // USDC has 6 decimals
      
      const result = await fetchQuote({
        fromChain: selectedChainId,
        toChain: TARGET_CHAIN_ID,
        fromToken: USDC_ADDRESSES[selectedChainId],
        toToken: USDC_ADDRESSES[TARGET_CHAIN_ID],
        fromAmount: amountInSmallestUnit.toString(),
        slippage: 0.005, // 0.5%
      });
      
      if (result) {
        setStep('quote');
      }
    } catch (error) {
      console.error('Failed to fetch quote:', error);
    }
  };
  
  /**
   * Execute bridge flow
   */
  const handleExecuteBridge = async () => {
    if (!quote) return;
    
    try {
      // Check if approval is needed
      const needsApproval = await checkApproval(quote);
      
      if (needsApproval) {
        setStep('approve');
        const approvalHash = await executeApproval(quote);
        
        if (!approvalHash) {
          // User rejected or error occurred
          return;
        }
      }
      
      // Execute bridge
      setStep('bridge');
      const bridgeHash = await executeBridge(quote);
      
      if (!bridgeHash) {
        // User rejected or error occurred
        return;
      }
      
      // Start tracking
      setStep('tracking');
      
      // Poll status
      const cleanup = pollStatus(
        bridgeHash,
        quote.action.fromChainId,
        quote.action.toChainId,
        (status) => {
          if (status.status === 'DONE') {
            onComplete?.();
          }
        }
      );
      
      // Cleanup will be called when component unmounts
      return cleanup;
    } catch (error) {
      console.error('Bridge execution failed:', error);
    }
  };
  
  /**
   * Render chain selector
   */
  const renderChainSelector = () => (
    <div className="space-y-3">
      <label className="text-sm font-medium">Select Source Chain</label>
      <div className="grid grid-cols-2 gap-2">
        {SUPPORTED_CHAINS.map((chain) => (
          <Button
            key={chain.id}
            variant={selectedChainId === chain.id ? 'default' : 'outline'}
            onClick={() => handleChainSelect(chain.id)}
            className="justify-start"
          >
            {chain.name}
          </Button>
        ))}
      </div>
      {currentChain && selectedChainId && currentChain.id !== selectedChainId && (
        <p className="text-sm text-yellow-600">
          Please switch to {SUPPORTED_CHAINS.find(c => c.id === selectedChainId)?.name} to continue
        </p>
      )}
    </div>
  );
  
  /**
   * Render amount input
   */
  const renderAmountInput = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium">Amount (USDC)</label>
        {balanceData && (
          <span className="text-sm text-muted-foreground">
            Balance: {formatUnits(balanceData.value, balanceData.decimals)} USDC
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="0.00"
          className="flex-1"
        />
        <Button variant="outline" onClick={handleMaxClick} disabled={!balanceData}>
          Max
        </Button>
      </div>
      {amount && !isAmountValid() && (
        <p className="text-sm text-destructive">
          {parseFloat(amount) <= 0 ? 'Amount must be greater than zero' : 'Insufficient balance'}
        </p>
      )}
    </div>
  );
  
  /**
   * Render quote display
   */
  const renderQuoteDisplay = () => {
    if (!quote) return null;
    
    const outputAmount = formatUnits(BigInt(quote.estimate.toAmount), 6);
    const minAmount = formatUnits(BigInt(quote.estimate.toAmountMin), 6);
    const gasCostUSD = quote.estimate.gasCosts[0]?.amountUSD || '0';
    const executionTime = Math.ceil(quote.estimate.executionDuration / 60); // Convert to minutes
    
    return (
      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You'll receive</span>
            <span className="font-medium">{outputAmount} USDC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Minimum received</span>
            <span>{minAmount} USDC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gas cost</span>
            <span>${gasCostUSD}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated time</span>
            <span>~{executionTime} min</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Bridge</span>
            <span>{quote.toolDetails.name}</span>
          </div>
        </div>
        
        <Button onClick={handleExecuteBridge} className="w-full" disabled={bridgeLoading}>
          {bridgeLoading ? 'Processing...' : 'Confirm Bridge'}
        </Button>
      </div>
    );
  };
  
  /**
   * Render status tracker
   */
  const renderStatusTracker = () => {
    if (!statusData) return null;
    
    const getStatusMessage = () => {
      switch (statusData.status) {
        case 'PENDING':
          return statusData.substatusMessage || 'Bridge in progress...';
        case 'DONE':
          return 'Bridge completed successfully!';
        case 'FAILED':
          return `Bridge failed: ${statusData.substatusMessage || 'Unknown error'}`;
        default:
          return 'Checking status...';
      }
    };
    
    const getStatusColor = () => {
      switch (statusData.status) {
        case 'DONE':
          return 'text-green-600';
        case 'FAILED':
          return 'text-destructive';
        default:
          return 'text-muted-foreground';
      }
    };
    
    return (
      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusMessage()}
          </div>
          
          {statusData.sending && (
            <div className="text-sm">
              <a
                href={statusData.sending.txLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View transaction →
              </a>
            </div>
          )}
          
          {statusData.status === 'PENDING' && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Waiting for confirmation...</span>
            </div>
          )}
        </div>
        
        {statusData.status === 'DONE' && (
          <Button onClick={onComplete} className="w-full">
            Done
          </Button>
        )}
      </div>
    );
  };
  
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Deposit from Another Chain</CardTitle>
        <CardDescription>
          Bridge USDC from any chain to Sepolia for Yellow Network
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Step 1: Chain Selection */}
        {renderChainSelector()}
        
        {/* Step 2: Amount Input */}
        {selectedChainId && renderAmountInput()}
        
        {/* Get Quote Button */}
        {selectedChainId && amount && step === 'select' && (
          <Button
            onClick={handleFetchQuote}
            className="w-full"
            disabled={!isAmountValid() || quoteLoading}
          >
            {quoteLoading ? 'Fetching quote...' : 'Get Quote'}
          </Button>
        )}
        
        {/* Quote Display */}
        {step === 'quote' && renderQuoteDisplay()}
        
        {/* Approval Status */}
        {step === 'approve' && (
          <div className="text-center space-y-2">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Waiting for approval...</p>
          </div>
        )}
        
        {/* Bridge Status */}
        {step === 'bridge' && (
          <div className="text-center space-y-2">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Waiting for bridge confirmation...</p>
          </div>
        )}
        
        {/* Status Tracking */}
        {step === 'tracking' && renderStatusTracker()}
        
        {/* Error Messages */}
        {(quoteError || approvalError || bridgeError || statusError) && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive">
              {quoteError || approvalError || bridgeError || statusError}
            </p>
          </div>
        )}
        
        {/* Cancel Button */}
        {onCancel && step !== 'tracking' && (
          <Button variant="outline" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
