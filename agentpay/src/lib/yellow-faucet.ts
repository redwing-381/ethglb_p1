/**
 * Yellow Network Faucet
 * 
 * Requests ytest.usd test tokens from Yellow Network's sandbox faucet.
 * These tokens are deposited directly into the user's Unified Balance (off-chain).
 */

const FAUCET_URL = 'https://clearnet-sandbox.yellow.com/faucet/requestTokens';

export interface FaucetResponse {
  success: boolean;
  message?: string;
  amount?: string;
  error?: string;
}

/**
 * Request test tokens from Yellow Network's sandbox faucet.
 * 
 * @param userAddress - The wallet address to receive tokens
 * @returns Promise with faucet response
 */
export async function requestFaucetTokens(userAddress: string): Promise<FaucetResponse> {
  try {
    console.log(`🚰 Requesting faucet tokens for ${userAddress}...`);
    
    const response = await fetch(FAUCET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Faucet request failed:', data);
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
      };
    }

    console.log('✅ Faucet response:', data);
    return {
      success: true,
      message: data.message || 'Tokens received!',
      amount: data.amount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Faucet request error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
