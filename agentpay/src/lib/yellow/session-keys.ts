/**
 * Session Key Manager
 * 
 * Manages ephemeral session keys for Yellow Network authentication.
 * Session keys are used to sign RPC requests without requiring
 * the user's main wallet signature for each operation.
 */

import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { keccak256, toBytes } from 'viem';

export interface SessionKeyPair {
  privateKey: `0x${string}`;
  publicKey: `0x${string}`;
}

export class SessionKeyManager {
  private sessionKey: SessionKeyPair | null = null;
  private expiresAt: number | null = null;

  /**
   * Generate a new session key pair
   */
  generateSessionKey(): SessionKeyPair {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    this.sessionKey = {
      privateKey,
      publicKey: account.address,
    };
    
    // Default expiry: 1 hour from now
    this.expiresAt = Date.now() + 3600 * 1000;
    
    return this.sessionKey;
  }

  /**
   * Get the current session key
   */
  getSessionKey(): SessionKeyPair | null {
    return this.sessionKey;
  }

  /**
   * Get expiration timestamp
   */
  getExpiresAt(): number | null {
    return this.expiresAt;
  }

  /**
   * Check if we have a valid (non-expired) session key
   */
  hasValidSessionKey(): boolean {
    if (!this.sessionKey || !this.expiresAt) {
      return false;
    }
    return Date.now() < this.expiresAt;
  }

  /**
   * Sign an RPC request with the session key
   */
  async signRequest(request: { req: unknown[] }): Promise<string> {
    if (!this.sessionKey) {
      throw new Error('No session key available');
    }

    const account = privateKeyToAccount(this.sessionKey.privateKey);
    
    // Create message hash from request
    const message = JSON.stringify(request.req);
    const messageHash = keccak256(toBytes(message));
    
    // Sign the hash
    const signature = await account.signMessage({
      message: { raw: messageHash },
    });
    
    return signature;
  }

  /**
   * Restore a session key from persisted state
   */
  restoreSessionKey(privateKey: `0x${string}`, expiresAt: number): boolean {
    if (Date.now() >= expiresAt) {
      return false; // Expired
    }

    const account = privateKeyToAccount(privateKey);
    this.sessionKey = {
      privateKey,
      publicKey: account.address,
    };
    this.expiresAt = expiresAt;
    
    return true;
  }

  /**
   * Clear the session key
   */
  clear(): void {
    this.sessionKey = null;
    this.expiresAt = null;
  }
}
