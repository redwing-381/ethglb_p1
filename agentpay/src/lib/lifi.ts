/**
 * LI.FI API Service
 * 
 * Provides cross-chain bridge functionality using LI.FI's API.
 * Uses direct API calls instead of SDK for simpler integration and better control.
 * 
 * API Documentation: https://docs.li.fi/integrate-li.fi-js-sdk/api-reference
 */

const LIFI_API_BASE = 'https://li.quest/v1';

/**
 * Token information
 */
export interface Token {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  name: string;
  priceUSD?: string;
  logoURI?: string;
}

/**
 * Fee cost breakdown
 */
export interface FeeCost {
  name: string;
  description: string;
  token: Token;
  amount: string;
  amountUSD: string;
}

/**
 * Gas cost breakdown
 */
export interface GasCost {
  type: string;
  price: string;
  estimate: string;
  limit: string;
  amount: string;
  amountUSD: string;
  token: Token;
}

/**
 * Bridge quote from LI.FI
 */
export interface LiFiQuote {
  id: string;
  type: 'lifi';
  tool: string;
  toolDetails: {
    key: string;
    name: string;
    logoURI: string;
  };
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: Token;
    toToken: Token;
    fromAmount: string;
    slippage: number;
    fromAddress: string;
    toAddress: string;
  };
  estimate: {
    fromAmount: string;
    fromAmountUSD: string;
    toAmount: string;
    toAmountMin: string;
    toAmountUSD: string;
    approvalAddress: string;
    executionDuration: number;
    feeCosts: FeeCost[];
    gasCosts: GasCost[];
  };
  transactionRequest: {
    data: string;
    to: string;
    value: string;
    from: string;
    chainId: number;
    gasLimit: string;
    gasPrice?: string;
  };
}

/**
 * Transaction information in status response
 */
export interface TransactionInfo {
  txHash: string;
  txLink: string;
  amount: string;
  token: Token;
  chainId: number;
  gasAmountUSD?: string;
  timestamp?: number;
}

/**
 * Bridge transaction status
 */
export interface StatusResponse {
  transactionId: string;
  sending: TransactionInfo;
  receiving?: TransactionInfo;
  status: 'NOT_FOUND' | 'INVALID' | 'PENDING' | 'DONE' | 'FAILED';
  substatus?: string;
  substatusMessage?: string;
  tool: string;
  fromAddress: string;
  toAddress: string;
  lifiExplorerLink: string;
}

/**
 * Chain information
 */
export interface Chain {
  key: string;
  name: string;
  chainType: string;
  id: number;
  coin: string;
  mainnet: boolean;
  nativeToken: Token;
}

/**
 * Parameters for getting a bridge quote
 */
export interface QuoteParams {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  slippage?: number;
  integrator?: string;
}

/**
 * Parameters for checking transaction status
 */
export interface StatusParams {
  txHash: string;
  fromChain?: number;
  toChain?: number;
  bridge?: string;
}

/**
 * Get a bridge quote from LI.FI
 * 
 * @param params Quote parameters
 * @returns Bridge quote with transaction data
 */
export async function getQuote(params: QuoteParams): Promise<LiFiQuote> {
  const queryParams = new URLSearchParams({
    fromChain: params.fromChain.toString(),
    toChain: params.toChain.toString(),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
  });

  if (params.toAddress) {
    queryParams.append('toAddress', params.toAddress);
  }

  if (params.slippage !== undefined) {
    queryParams.append('slippage', params.slippage.toString());
  }

  if (params.integrator) {
    queryParams.append('integrator', params.integrator);
  }

  const url = `${LIFI_API_BASE}/quote?${queryParams.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `LI.FI API error: ${response.status} ${response.statusText}`
      );
    }

    const quote: LiFiQuote = await response.json();
    return quote;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch quote from LI.FI');
  }
}

/**
 * Get transaction status from LI.FI
 * 
 * @param params Status parameters
 * @returns Transaction status
 */
export async function getStatus(params: StatusParams): Promise<StatusResponse> {
  const queryParams = new URLSearchParams({
    txHash: params.txHash,
  });

  if (params.fromChain !== undefined) {
    queryParams.append('fromChain', params.fromChain.toString());
  }

  if (params.toChain !== undefined) {
    queryParams.append('toChain', params.toChain.toString());
  }

  if (params.bridge) {
    queryParams.append('bridge', params.bridge);
  }

  const url = `${LIFI_API_BASE}/status?${queryParams.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `LI.FI API error: ${response.status} ${response.statusText}`
      );
    }

    const status: StatusResponse = await response.json();
    return status;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch status from LI.FI');
  }
}

/**
 * Get list of supported chains
 * 
 * @returns Array of supported chains
 */
export async function getChains(): Promise<Chain[]> {
  const url = `${LIFI_API_BASE}/chains`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`LI.FI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.chains || [];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch chains from LI.FI');
  }
}

/**
 * Get list of supported tokens for a chain
 * 
 * @param chainId Chain ID
 * @returns Array of tokens
 */
export async function getTokens(chainId: number): Promise<Token[]> {
  const url = `${LIFI_API_BASE}/tokens?chains=${chainId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`LI.FI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tokens = data.tokens?.[chainId] || [];
    return tokens;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch tokens from LI.FI');
  }
}

/**
 * Check ERC-20 token allowance
 * 
 * @param tokenAddress Token contract address
 * @param ownerAddress Token owner address
 * @param spenderAddress Spender address (LI.FI contract)
 * @param chainId Chain ID
 * @returns Current allowance as bigint
 */
export async function checkTokenAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  chainId: number
): Promise<bigint> {
  // This would typically use viem or ethers to query the blockchain
  // For now, we'll return 0 to indicate approval is needed
  // This will be implemented when integrating with wagmi
  return 0n;
}
