/**
 * Wallet Types for Yellow Integration
 * 
 * Type definitions for wagmi hook functions that are passed to the Yellow client
 * for signing and transaction operations.
 */

/**
 * Function type for signing EIP-712 typed data.
 * Used for Yellow Network authentication.
 */
export type SignTypedDataFn = (params: {
  domain: { name: string };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}) => Promise<`0x${string}`>;

/**
 * Function type for writing to smart contracts.
 * Used for channel creation and closure on-chain operations.
 */
export type WriteContractFn = (params: {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: unknown[];
  value?: bigint;
}) => Promise<`0x${string}`>;

/**
 * Function type for waiting for transaction confirmation.
 * Used after submitting on-chain transactions.
 */
export type WaitForTransactionFn = (hash: `0x${string}`) => Promise<void>;

/**
 * Function type for signing raw message data.
 * Used for signing channel state updates.
 */
export type SignMessageFn = (params: {
  message: `0x${string}` | string;
}) => Promise<`0x${string}`>;

/**
 * Function type for switching chains.
 * Used to ensure wallet is on correct network before transactions.
 */
export type SwitchChainFn = (chainId: number) => Promise<void>;

/**
 * Combined wallet functions passed to Yellow client operations.
 * These are extracted from wagmi hooks and passed to session operations.
 */
export interface WalletFunctions {
  signTypedData: SignTypedDataFn;
  writeContract: WriteContractFn;
  waitForTransaction: WaitForTransactionFn;
  signMessage: SignMessageFn;
  walletAddress: `0x${string}`;
  /** Current chain ID the wallet is connected to */
  currentChainId?: number;
  /** Function to switch chains if needed */
  switchChain?: SwitchChainFn;
}

/**
 * Subset of wallet functions needed for channel closure.
 */
export type CloseChannelWalletFunctions = Pick<
  WalletFunctions, 
  'writeContract' | 'waitForTransaction' | 'signMessage' | 'walletAddress' | 'currentChainId' | 'switchChain'
>;
