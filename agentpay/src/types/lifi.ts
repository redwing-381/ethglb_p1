/**
 * LI.FI Type Definitions
 * 
 * TypeScript interfaces for LI.FI API responses and requests.
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

export interface FeeCost {
  name: string;
  description: string;
  token: Token;
  amount: string;
  amountUSD: string;
}

export interface GasCost {
  type: string;
  price: string;
  estimate: string;
  limit: string;
  amount: string;
  amountUSD: string;
  token: Token;
}

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

export interface TransactionInfo {
  txHash: string;
  txLink: string;
  amount: string;
  token: Token;
  chainId: number;
  gasAmountUSD?: string;
  timestamp?: number;
}

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

export interface Chain {
  key: string;
  name: string;
  chainType: string;
  id: number;
  coin: string;
  mainnet: boolean;
  nativeToken: Token;
}

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

export interface StatusParams {
  txHash: string;
  fromChain?: number;
  toChain?: number;
  bridge?: string;
}
