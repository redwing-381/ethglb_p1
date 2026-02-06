/**
 * Wallet Error Utilities
 * 
 * Error types and utilities for handling wallet operation failures.
 * Provides user-friendly messages and recovery information.
 */

/**
 * Error codes for wallet operations.
 */
export type WalletErrorCode =
  | 'SIGNATURE_REJECTED'
  | 'TRANSACTION_REJECTED'
  | 'TRANSACTION_FAILED'
  | 'NETWORK_ERROR'
  | 'WALLET_NOT_CONNECTED'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_BALANCE';

/**
 * Structured wallet error with user-friendly message and recovery info.
 */
export interface WalletError {
  code: WalletErrorCode;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

/**
 * User-friendly error messages for each error code.
 */
const ERROR_MESSAGES: Record<WalletErrorCode, string> = {
  SIGNATURE_REJECTED: 'Signature cancelled - please try again',
  TRANSACTION_REJECTED: 'Transaction cancelled - please try again',
  TRANSACTION_FAILED: 'Transaction failed - please check your wallet',
  NETWORK_ERROR: 'Network error - please check your connection',
  WALLET_NOT_CONNECTED: 'Please connect your wallet first',
  INSUFFICIENT_FUNDS: 'Insufficient funds for gas fees',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this payment',
};

/**
 * Error codes that can be retried by the user.
 */
const RECOVERABLE_ERRORS: WalletErrorCode[] = [
  'SIGNATURE_REJECTED',
  'TRANSACTION_REJECTED',
  'NETWORK_ERROR',
  'WALLET_NOT_CONNECTED',
];

/**
 * Create a structured wallet error with appropriate message and recovery flag.
 * 
 * @param code - The error code
 * @param details - Optional additional error details
 * @returns A structured WalletError object
 */
export function createWalletError(
  code: WalletErrorCode, 
  details?: Record<string, unknown>
): WalletError {
  return {
    code,
    message: ERROR_MESSAGES[code],
    details,
    recoverable: RECOVERABLE_ERRORS.includes(code),
  };
}

/**
 * Check if an error is a user rejection (signature or transaction).
 * 
 * @param error - The error to check
 * @returns True if the error was caused by user rejection
 */
export function isUserRejection(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('user rejected') ||
      message.includes('user denied') ||
      message.includes('rejected by user') ||
      message.includes('cancelled')
    );
  }
  return false;
}

/**
 * Parse a raw error into a structured WalletError.
 * 
 * @param error - The raw error from wallet operations
 * @returns A structured WalletError
 */
export function parseWalletError(error: unknown): WalletError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for user rejection
    if (isUserRejection(error)) {
      if (message.includes('signature') || message.includes('sign')) {
        return createWalletError('SIGNATURE_REJECTED');
      }
      return createWalletError('TRANSACTION_REJECTED');
    }
    
    // Check for insufficient funds
    if (message.includes('insufficient funds') || message.includes('insufficient balance')) {
      if (message.includes('gas')) {
        return createWalletError('INSUFFICIENT_FUNDS');
      }
      return createWalletError('INSUFFICIENT_BALANCE');
    }
    
    // Check for network errors
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return createWalletError('NETWORK_ERROR', { originalMessage: error.message });
    }
    
    // Default to transaction failed
    return createWalletError('TRANSACTION_FAILED', { originalMessage: error.message });
  }
  
  return createWalletError('TRANSACTION_FAILED', { originalError: String(error) });
}
