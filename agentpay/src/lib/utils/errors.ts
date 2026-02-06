/**
 * Error Message Utilities
 * 
 * Generates user-friendly error messages with actionable next steps.
 */

/**
 * Generate a user-friendly error message from an error object
 * 
 * @param error - Error object or unknown error
 * @returns User-friendly error message with actionable next steps
 * 
 * @example
 * getErrorMessage(new Error('insufficient balance'))
 * // Returns: "Insufficient balance. Please add more funds or create a new session."
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for specific error types
    if (message.includes('insufficient') || message.includes('balance')) {
      return 'Insufficient balance. Please add more funds or create a new session.';
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    if (message.includes('agent')) {
      return 'Agent failed to complete task. Please try again or contact support.';
    }
    
    if (message.includes('session')) {
      return 'Session error. Please check your wallet connection and try again.';
    }
    
    if (message.includes('transfer') || message.includes('payment')) {
      return 'Payment failed. Please check your balance and try again.';
    }
    
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    if (message.includes('invalid') || message.includes('validation')) {
      return 'Invalid input. Please check your entry and try again.';
    }
    
    // Generic error with original message
    return `Error: ${error.message}. Please try again.`;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Predefined error messages for common scenarios
 */
export const ERROR_MESSAGES = {
  INSUFFICIENT_BALANCE: 'Insufficient balance. Please add more funds or create a new session.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  AGENT_FAILED: (agentName: string) => `${agentName} failed to complete work. Please try again.`,
  SESSION_CREATION_FAILED: 'Failed to create session. Please check your wallet connection and try again.',
  TRANSFER_FAILED: 'Payment failed. Please check your balance and try again.',
  INVALID_INPUT: 'Please enter a valid task description.',
  TIMEOUT: 'Request timed out. Please try again.',
  WALLET_NOT_CONNECTED: 'Please connect your wallet to continue.',
  GENERIC: 'An error occurred. Please try again.',
} as const;

/**
 * Check if an error message contains actionable text
 * 
 * @param message - Error message to check
 * @returns true if message contains actionable phrases
 */
export function hasActionableText(message: string): boolean {
  const actionablePhrases = [
    'please',
    'try again',
    'check',
    'add',
    'create',
    'connect',
    'contact',
  ];
  
  const lowerMessage = message.toLowerCase();
  return actionablePhrases.some(phrase => lowerMessage.includes(phrase));
}
