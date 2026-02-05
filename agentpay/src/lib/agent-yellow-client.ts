/**
 * Agent Yellow Client
 * 
 * Extended Yellow Network client for agent wallets.
 * Handles independent authentication using agent private keys.
 */

import { type PrivateKeyAccount } from 'viem/accounts';
import { YellowClient, type YellowClientConfig, type AuthParams, type AuthResult } from './yellow';
import { TEST_TOKEN, SESSION_EXPIRY, DEFAULT_SCOPE } from './yellow-config';

export interface AgentYellowClientConfig extends YellowClientConfig {
  agentAccount: PrivateKeyAccount;
  agentName: string;
}

/**
 * Agent Yellow Client
 * 
 * Extends YellowClient to provide agent-specific authentication
 * using the agent's private key for EIP-712 signatures.
 */
export class AgentYellowClient extends YellowClient {
  private agentAccount: PrivateKeyAccount;
  private agentName: string;
  private authRetryCount: number = 0;
  private maxAuthRetries: number = 5;
  private authRetryDelays: number[] = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
  
  constructor(config: AgentYellowClientConfig) {
    super(config);
    this.agentAccount = config.agentAccount;
    this.agentName = config.agentName;
  }
  
  /**
   * Authenticate agent with Yellow Network
   * 
   * Uses the agent's private key to sign EIP-712 messages.
   * Implements automatic retry with exponential backoff.
   */
  async authenticateAgent(): Promise<AuthResult> {
    console.log(`🔐 Authenticating ${this.agentName} with Yellow Network...`);
    
    const authParams: AuthParams = {
      walletAddress: this.agentAccount.address,
      signTypedData: async (params) => {
        // Sign EIP-712 typed data using agent's private key
        return this.agentAccount.signTypedData({
          domain: params.domain,
          types: params.types,
          primaryType: params.primaryType,
          message: params.message,
        });
      },
      allowances: [
        {
          asset: TEST_TOKEN,
          amount: '1000000000', // 1B ytest.usd (6 decimals = 1B USDC)
        },
      ],
      scope: DEFAULT_SCOPE,
      expiresAt: Date.now() + SESSION_EXPIRY,
    };
    
    try {
      const result = await this.authenticate(authParams);
      this.authRetryCount = 0; // Reset retry count on success
      console.log(`✅ ${this.agentName} authenticated successfully`);
      return result;
    } catch (error) {
      console.error(`❌ ${this.agentName} authentication failed:`, error);
      
      // Retry with exponential backoff
      if (this.authRetryCount < this.maxAuthRetries) {
        const delay = this.authRetryDelays[this.authRetryCount] || 16000;
        this.authRetryCount++;
        
        console.log(`⏳ Retrying authentication for ${this.agentName} in ${delay}ms (attempt ${this.authRetryCount}/${this.maxAuthRetries})...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.authenticateAgent();
      }
      
      throw error;
    }
  }
  
  /**
   * Connect and authenticate in one step
   */
  async connectAndAuthenticate(): Promise<void> {
    await this.connect();
    await this.authenticateAgent();
  }
  
  /**
   * Handle WebSocket reconnection with re-authentication
   */
  async handleReconnection(): Promise<void> {
    console.log(`🔄 ${this.agentName} reconnecting to Yellow Network...`);
    
    try {
      await this.connect();
      await this.authenticateAgent();
      console.log(`✅ ${this.agentName} reconnected and re-authenticated`);
    } catch (error) {
      console.error(`❌ ${this.agentName} reconnection failed:`, error);
      throw error;
    }
  }
  
  /**
   * Get agent's address
   */
  getAgentAddress(): `0x${string}` {
    return this.agentAccount.address;
  }
  
  /**
   * Get agent's name
   */
  getAgentName(): string {
    return this.agentName;
  }
}
