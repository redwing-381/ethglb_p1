/**
 * Amount Formatting Utilities
 * 
 * Centralized functions for formatting ytest.usd amounts (6 decimals)
 * throughout the AgentPay application.
 */

/**
 * Formats a ytest.usd amount (6 decimals) for display
 * 
 * @param amount - Raw amount from Yellow Network (in smallest unit)
 * @param decimals - Number of decimals (default: 6 for ytest.usd)
 * @returns Formatted string like "5.00 USDC"
 * 
 * @example
 * formatUSDC(5000000) // Returns: "5.00 USDC"
 * formatUSDC("5000000") // Returns: "5.00 USDC"
 * formatUSDC(null) // Returns: "0.00 USDC"
 * formatUSDC(0) // Returns: "0.00 USDC"
 */
export function formatUSDC(
  amount: number | string | null | undefined,
  decimals: number = 6
): string {
  // Handle edge cases
  if (amount === null || amount === undefined || amount === '') {
    return '0.00 USDC';
  }
  
  // Convert to number if string
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle negative or invalid numbers
  if (isNaN(numAmount) || numAmount < 0) {
    return '0.00 USDC';
  }
  
  // Divide by 10^decimals and format to 2 decimal places
  const formatted = (numAmount / Math.pow(10, decimals)).toFixed(2);
  
  return `${formatted} USDC`;
}

/**
 * Formats amount without currency suffix
 * 
 * @param amount - Raw amount from Yellow Network (in smallest unit)
 * @param decimals - Number of decimals (default: 6 for ytest.usd)
 * @returns Formatted string like "5.00"
 * 
 * @example
 * formatAmount(5000000) // Returns: "5.00"
 * formatAmount("5000000") // Returns: "5.00"
 */
export function formatAmount(
  amount: number | string | null | undefined,
  decimals: number = 6
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '0.00';
  }
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount) || numAmount < 0) {
    return '0.00';
  }
  
  return (numAmount / Math.pow(10, decimals)).toFixed(2);
}

/**
 * Parses a formatted amount back to raw units
 * 
 * @param formattedAmount - Formatted amount like "5.00" or "5.00 USDC"
 * @param decimals - Number of decimals (default: 6 for ytest.usd)
 * @returns Raw amount in smallest unit
 * 
 * @example
 * parseAmount("5.00") // Returns: 5000000
 * parseAmount("5.00 USDC") // Returns: 5000000
 */
export function parseAmount(
  formattedAmount: string,
  decimals: number = 6
): number {
  // Remove currency suffix if present
  const cleanAmount = formattedAmount.replace(/\s*USDC\s*$/i, '').trim();
  
  const numAmount = parseFloat(cleanAmount);
  
  if (isNaN(numAmount) || numAmount < 0) {
    return 0;
  }
  
  return Math.round(numAmount * Math.pow(10, decimals));
}
