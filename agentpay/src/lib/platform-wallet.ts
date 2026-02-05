/**
 * Platform Wallet Configuration
 * 
 * Server-side wallet that controls agent payment addresses.
 * The private key is read from environment variables and never exposed to client-side code.
 */

import { privateKeyToAccount } from 'viem/accounts';

export interface PlatformWalletConfig {
  privateKey: `0x${string}` | null;
  address: `0x${string}` | null;
  isConfigured: boolean;
}

/**
 * Get platform wallet configuration from environment variables.
 * Returns isConfigured: false if the private key is not set.
 * 
 * @returns PlatformWalletConfig with wallet details or null values if not configured
 */
export function getPlatformWallet(): PlatformWalletConfig {
  const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY as `0x${string}` | undefined;
  
  if (!privateKey || privateKey.length < 66) {
    console.warn('⚠️ PLATFORM_WALLET_PRIVATE_KEY not configured - agent payments disabled');
    return { 
      privateKey: null, 
      address: null, 
      isConfigured: false 
    };
  }
  
  try {
    const account = privateKeyToAccount(privateKey);
    return {
      privateKey,
      address: account.address,
      isConfigured: true,
    };
  } catch (error) {
    console.error('❌ Invalid PLATFORM_WALLET_PRIVATE_KEY:', error);
    return { 
      privateKey: null, 
      address: null, 
      isConfigured: false 
    };
  }
}

/**
 * Check if platform wallet is configured without exposing the private key.
 * Safe to call from any context.
 */
export function isPlatformWalletConfigured(): boolean {
  return getPlatformWallet().isConfigured;
}
