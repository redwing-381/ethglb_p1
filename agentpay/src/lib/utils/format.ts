/**
 * Amount Formatting Utilities
 * 
 * Centralized functions for formatting ytest.usd amounts (6 decimals)
 * throughout the AgentPay application.
 */

/**
 * Formats a ytest.usd amount for display
 * 
 * Intelligently handles both:
 * - Raw units (e.g., 5000000 for 5 USDC)
 * - Human-readable format (e.g., "5.00" or "0.02")
 * 
 * @param amount - Amount in either raw units or human-readable format
 * @param decimals - Number of decimals (default: 6 for ytest.usd)
 * @returns Formatted string like "5.00 USDC"
 * 
 * @example
 * formatUSDC(5000000) // Returns: "5.00 USDC" (raw units)
 * formatUSDC("5000000") // Returns: "5.00 USDC" (raw units as string)
 * formatUSDC("5.00") // Returns: "5.00 USDC" (human-readable)
 * formatUSDC("0.02") // Returns: "0.02 USDC" (human-readable)
 * formatUSDC(null) // Returns: "0.00 USDC"
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
  
  // Detect if this is raw units or human-readable format
  // Raw units for USDC would be >= 1000 for even 0.001 USDC
  // Human-readable amounts are typically < 1000 (e.g., 0.02, 5.00, 100.00)
  // We use 1000 as threshold since amounts > 1000 USDC are unlikely in this app
  const isRawUnits = numAmount >= 1000;
  
  let formatted: string;
  if (isRawUnits) {
    // Divide by 10^decimals and format to 2 decimal places
    formatted = (numAmount / Math.pow(10, decimals)).toFixed(2);
  } else {
    // Already in human-readable format
    formatted = numAmount.toFixed(2);
  }
  
  return `${formatted} USDC`;
}

/**
 * Formats amount without currency suffix
 * 
 * Intelligently handles both:
 * - Raw units (e.g., 5000000 for 5 USDC)
 * - Human-readable format (e.g., "5.00" or "0.02")
 * 
 * @param amount - Amount in either raw units or human-readable format
 * @param decimals - Number of decimals (default: 6 for ytest.usd)
 * @returns Formatted string like "5.00"
 * 
 * @example
 * formatAmount(5000000) // Returns: "5.00" (raw units)
 * formatAmount("5000000") // Returns: "5.00" (raw units as string)
 * formatAmount("5.00") // Returns: "5.00" (human-readable)
 * formatAmount("0.02") // Returns: "0.02" (human-readable)
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
  
  // Detect if this is raw units or human-readable format
  const isRawUnits = numAmount >= 1000;
  
  if (isRawUnits) {
    return (numAmount / Math.pow(10, decimals)).toFixed(2);
  } else {
    return numAmount.toFixed(2);
  }
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
