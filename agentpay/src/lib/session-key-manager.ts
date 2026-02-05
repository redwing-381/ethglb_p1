/**
 * Session Key Manager
 * 
 * Handles generation and storage of ephemeral session keys for signing
 * off-chain operations without requiring main wallet signatures.
 */

import { 
  generatePrivateKey, 
  privateKeyToAccount,
  type PrivateKeyAccount,
} from 'viem/accounts';
import { toHex, keccak256 } from 'viem';
import { SESSION_EXPIRY } from './yellow-config';

/**
 * Session key pair containing both public and private keys
 */
export interface SessionKeyPair {
  publicKey: `0x${string}`;
  privateKey: `0x${string}`;
}

/**
 * RPC Request structure for signing
 */
export interface RPCRequest {
  req: [number, string, Record<string, unknown>, number];
  sig?: string[];
}

/**
 * Session Key Manager class
 * 
 * Manages ephemeral keypairs for signing off-chain operations.
 * Keys are stored in memory and cleared on session expiration.
 */
export class SessionKeyManager {
  private sessionKey: SessionKeyPair | null = null;
  private account: PrivateKeyAccount | null = null;
  private expiresAt: number | null = null;

  /**
   * Generate a new session key pair
   * 
   * Creates a new ephemeral keypair using viem's generatePrivateKey.
   * The key is stored in memory and set to expire after SESSION_EXPIRY.
   * 
   * @returns The generated session key pair
   */
  generateSessionKey(): SessionKeyPair {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    this.sessionKey = {
      publicKey: account.address,
      privateKey: privateKey,
    };
    this.account = account;
    this.expiresAt = Date.now() + SESSION_EXPIRY;
    
    return this.sessionKey;
  }

  /**
   * Get the current session key pair
   * 
   * Returns the stored session key if it exists and hasn't expired.
   * Returns null if no key exists or if the key has expired.
   * 
   * @returns The session key pair or null
   */
  getSessionKey(): SessionKeyPair | null {
    if (!this.sessionKey) {
      return null;
    }
    
    // Check if session has expired
    if (this.expiresAt && Date.now() > this.expiresAt) {
      this.clearSessionKey();
      return null;
    }
    
    return this.sessionKey;
  }

  /**
   * Clear the session key
   * 
   * Removes the stored session key and account from memory.
   * Should be called on logout or session expiration.
   */
  clearSessionKey(): void {
    this.sessionKey = null;
    this.account = null;
    this.expiresAt = null;
  }

  /**
   * Check if a valid session key exists
   * 
   * @returns True if a non-expired session key exists
   */
  hasValidSessionKey(): boolean {
    return this.getSessionKey() !== null;
  }

  /**
   * Get the session expiration timestamp
   * 
   * @returns The expiration timestamp in milliseconds, or null if no session
   */
  getExpiresAt(): number | null {
    return this.expiresAt;
  }

  /**
   * Sign a message using the session key
   * 
   * Signs an arbitrary message using the session key's private key.
   * Throws an error if no session key exists.
   * 
   * @param message - The message to sign
   * @returns The signature as a hex string
   */
  async signMessage(message: string): Promise<`0x${string}`> {
    if (!this.account) {
      throw new Error('No session key available. Call generateSessionKey() first.');
    }
    
    // Check expiration
    if (this.expiresAt && Date.now() > this.expiresAt) {
      this.clearSessionKey();
      throw new Error('Session key has expired. Please re-authenticate.');
    }
    
    return this.account.signMessage({ message });
  }

  /**
   * Sign an RPC request using the session key
   * 
   * Signs the request payload using raw ECDSA (no EIP-191 prefix).
   * This matches the Yellow SDK's createECDSAMessageSigner approach:
   * 1. JSON.stringify the payload (req array)
   * 2. Convert to hex using toHex()
   * 3. Hash with keccak256
   * 4. Sign the hash directly (raw ECDSA)
   * 
   * @param request - The RPC request to sign
   * @returns The signature as a hex string (65 bytes: r + s + v)
   */
  async signRequest(request: RPCRequest): Promise<`0x${string}`> {
    if (!this.account || !this.sessionKey) {
      throw new Error('No session key available. Call generateSessionKey() first.');
    }
    
    // Check expiration
    if (this.expiresAt && Date.now() > this.expiresAt) {
      this.clearSessionKey();
      throw new Error('Session key has expired. Please re-authenticate.');
    }
    
    // Match Yellow SDK's createECDSAMessageSigner approach:
    // 1. JSON.stringify the payload with bigint handling
    // 2. Convert to hex
    // 3. keccak256 hash
    // 4. Raw ECDSA sign (no EIP-191 prefix)
    const jsonPayload = JSON.stringify(request.req, (_, v) => 
      typeof v === 'bigint' ? v.toString() : v
    );
    const hexMessage = toHex(jsonPayload);
    const hash = keccak256(hexMessage);
    
    // Use account.sign({ hash }) for raw ECDSA signing (no prefix)
    return this.account.sign({ hash });
  }

  /**
   * Get the session key's public address
   * 
   * @returns The public address or null if no session key
   */
  getPublicAddress(): `0x${string}` | null {
    return this.sessionKey?.publicKey ?? null;
  }

  /**
   * Restore a session key from persisted state
   * 
   * Used for restoring session state after page reload.
   * Only restores if the key hasn't expired.
   * 
   * @param privateKey - The private key to restore
   * @param expiresAt - The expiration timestamp
   * @returns True if restoration was successful
   */
  restoreSessionKey(privateKey: `0x${string}`, expiresAt: number): boolean {
    // Don't restore expired keys
    if (Date.now() > expiresAt) {
      return false;
    }
    
    try {
      const account = privateKeyToAccount(privateKey);
      
      this.sessionKey = {
        publicKey: account.address,
        privateKey: privateKey,
      };
      this.account = account;
      this.expiresAt = expiresAt;
      
      return true;
    } catch {
      return false;
    }
  }
}

// Export a singleton instance for convenience
export const sessionKeyManager = new SessionKeyManager();

export default SessionKeyManager;
