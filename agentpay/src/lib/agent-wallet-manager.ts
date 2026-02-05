/**
 * Platform Wallet Manager
 * 
 * Manages autonomous agent wallets with their own private keys and Yellow sessions.
 * Each agent has its own identity, wallet, and can transact independently.
 * 
 * This is the server-side wallet manager that securely stores agent private keys
 * and provides signing functions without exposing the keys.
 */

import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { AgentYellowClient } from './agent-yellow-client';
import { CLEARNODE_URL, CHAIN_ID, CUSTODY_ADDRESS, ADJUDICATOR_ADDRESS } from './yellow-config';
import { createWalletError, type WalletError } from './wallet-errors';

export type AgentType = 'orchestrator' | 'researcher' | 'writer';

export interface AgentWallet {
  type: AgentType;
  name: string;
  address: `0x${string}`;
  yellowClient?: AgentYellowClient;
  balance: string;
  
  // Sign a message (private key never exposed)
  sign(message: string): Promise<`0x${string}`>;
  
  // Make a transfer to another agent
  transfer(toAddress: string, amount: string): Promise<TransferResult>;
  
  // Query current balance from Yellow
  refreshBalance(): Promise<string>;
}

export interface TransferResult {
  success: boolean;
  transactionId?: number | string;
  senderBalance?: string;
  receiverBalance?: string;
  error?: string;
}

export interface FundingResult {
  success: boolean;
  transactionId?: string;
  newBalance?: string;
  error?: string;
}

export interface WalletState {
  orchestrator: AgentWalletState;
  researcher: AgentWalletState;
  writer: AgentWalletState;
}

export interface AgentWalletState {
  type: AgentType;
  address: `0x${string}`;
  balance: string;
  // Note: private key NOT included in serialization
}

// Internal wallet implementation
class AgentWalletImpl implements AgentWallet {
  private account: PrivateKeyAccount;
  public yellowClient?: AgentYellowClient;
  public balance: string = '0.00';
  
  constructor(
    public readonly type: AgentType,
    public readonly name: string,
    privateKey: `0x${string}`
  ) {
    this.account = privateKeyToAccount(privateKey);
  }
  
  get address(): `0x${string}` {
    return this.account.address;
  }
  
  async sign(message: string): Promise<`0x${string}`> {
    return this.account.signMessage({ message });
  }
  
  async initializeYellowClient(): Promise<void> {
    if (this.yellowClient) {
      console.log(`⚠️ Yellow client already initialized for ${this.name}`);
      return;
    }
    
    console.log(`🔌 Creating Yellow client for ${this.name}...`);
    
    this.yellowClient = new AgentYellowClient({
      clearnodeUrl: CLEARNODE_URL,
      chainId: CHAIN_ID,
      custodyAddress: CUSTODY_ADDRESS,
      adjudicatorAddress: ADJUDICATOR_ADDRESS,
      agentAccount: this.account,
      agentName: this.name,
      onBalanceUpdate: (balance) => {
        this.balance = balance;
        console.log(`💰 ${this.name} balance updated: ${balance}`);
      },
    });
    
    await this.yellowClient.connectAndAuthenticate();
    await this.refreshBalance();
    
    console.log(`✅ ${this.name} Yellow client initialized`);
  }
  
  async transfer(toAddress: string, amount: string): Promise<TransferResult> {
    if (!this.yellowClient) {
      return {
        success: false,
        error: 'Yellow client not initialized',
      };
    }
    
    try {
      const result = await this.yellowClient.transfer(toAddress as `0x${string}`, amount);
      await this.refreshBalance();
      
      return {
        success: true,
        transactionId: result.transactionId,
        senderBalance: this.balance,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  async refreshBalance(): Promise<string> {
    if (!this.yellowClient) {
      return this.balance;
    }
    
    try {
      this.balance = await this.yellowClient.queryBalance();
      return this.balance;
    } catch (error) {
      console.error(`Failed to refresh balance for ${this.name}:`, error);
      return this.balance;
    }
  }
}

/**
 * Platform Wallet Manager
 * 
 * Manages all agent wallets with secure key storage and Yellow Network integration.
 */
export class PlatformWalletManager {
  private agents: Map<AgentType, AgentWalletImpl> = new Map();
  private initialized: boolean = false;
  
  /**
   * Initialize all agent wallets from environment variables
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('⚠️ Platform wallet manager already initialized');
      return;
    }
    
    console.log('🤖 Initializing platform wallet manager...');
    
    // Load private keys from environment variables
    const orchestratorKey = process.env.ORCHESTRATOR_PRIVATE_KEY as `0x${string}` | undefined;
    const researcherKey = process.env.RESEARCHER_PRIVATE_KEY as `0x${string}` | undefined;
    const writerKey = process.env.WRITER_PRIVATE_KEY as `0x${string}` | undefined;
    
    if (!orchestratorKey || !researcherKey || !writerKey) {
      throw new Error(
        'Missing agent private keys in environment variables. ' +
        'Please set ORCHESTRATOR_PRIVATE_KEY, RESEARCHER_PRIVATE_KEY, and WRITER_PRIVATE_KEY'
      );
    }
    
    // Create agent wallets
    const agentConfigs: Array<{ type: AgentType; name: string; key: `0x${string}` }> = [
      { type: 'orchestrator', name: 'Orchestrator Agent', key: orchestratorKey },
      { type: 'researcher', name: 'Researcher Agent', key: researcherKey },
      { type: 'writer', name: 'Writer Agent', key: writerKey },
    ];
    
    for (const { type, name, key } of agentConfigs) {
      const wallet = new AgentWalletImpl(type, name, key);
      this.agents.set(type, wallet);
      console.log(`✅ Initialized ${name}: ${wallet.address}`);
    }
    
    this.initialized = true;
    console.log('✅ Platform wallet manager initialized');
  }
  
  /**
   * Initialize Yellow clients for all agents
   */
  async initializeYellowClients(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Platform wallet manager not initialized');
    }
    
    console.log('🔌 Initializing Yellow clients for all agents...');
    
    const initPromises = Array.from(this.agents.values()).map(wallet => 
      wallet.initializeYellowClient()
    );
    
    await Promise.all(initPromises);
    
    console.log('✅ All agent Yellow clients initialized');
  }
  
  /**
   * Get agent wallet by type
   */
  getAgentWallet(agentType: AgentType): AgentWallet {
    const wallet = this.agents.get(agentType);
    if (!wallet) {
      throw new Error(`Agent wallet not found: ${agentType}`);
    }
    return wallet;
  }
  
  /**
   * Get all agent wallets
   */
  getAllAgentWallets(): AgentWallet[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Fund an agent from user wallet
   */
  async fundAgent(
    agentType: AgentType,
    amount: string,
    fromAddress: string
  ): Promise<FundingResult> {
    const wallet = this.agents.get(agentType);
    if (!wallet) {
      return {
        success: false,
        error: `Agent wallet not found: ${agentType}`,
      };
    }
    
    // Note: Funding requires the user's Yellow client to transfer to agent
    // This method is a placeholder - actual funding happens via user's client
    console.log(`💸 Funding ${wallet.name} with ${amount} USDC from ${fromAddress}...`);
    
    return {
      success: true,
      newBalance: wallet.balance,
    };
  }
  
  /**
   * Get agent balance
   */
  async getAgentBalance(agentType: AgentType): Promise<string> {
    const wallet = this.agents.get(agentType);
    if (!wallet) {
      throw new Error(`Agent wallet not found: ${agentType}`);
    }
    
    return wallet.refreshBalance();
  }
  
  /**
   * Serialize wallet state (for persistence)
   * Note: Private keys are NOT included in serialization
   */
  serializeState(): WalletState {
    const orchestrator = this.agents.get('orchestrator');
    const researcher = this.agents.get('researcher');
    const writer = this.agents.get('writer');
    
    if (!orchestrator || !researcher || !writer) {
      throw new Error('Not all agent wallets are initialized');
    }
    
    return {
      orchestrator: {
        type: 'orchestrator',
        address: orchestrator.address,
        balance: orchestrator.balance,
      },
      researcher: {
        type: 'researcher',
        address: researcher.address,
        balance: researcher.balance,
      },
      writer: {
        type: 'writer',
        address: writer.address,
        balance: writer.balance,
      },
    };
  }
  
  /**
   * Deserialize wallet state (for restoration)
   * Note: This only restores balances, not private keys
   */
  async deserializeState(state: WalletState): Promise<void> {
    const orchestrator = this.agents.get('orchestrator');
    const researcher = this.agents.get('researcher');
    const writer = this.agents.get('writer');
    
    if (!orchestrator || !researcher || !writer) {
      throw new Error('Agent wallets must be initialized before deserializing state');
    }
    
    // Restore balances
    orchestrator.balance = state.orchestrator.balance;
    researcher.balance = state.researcher.balance;
    writer.balance = state.writer.balance;
    
    console.log('✅ Wallet state restored');
  }
  
  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get all agent addresses
   */
  getAgentAddresses(): Record<AgentType, `0x${string}`> {
    const addresses: Record<string, `0x${string}`> = {};
    
    this.agents.forEach((wallet, type) => {
      addresses[type] = wallet.address;
    });
    
    return addresses as Record<AgentType, `0x${string}`>;
  }
}

// Singleton instance
let managerInstance: PlatformWalletManager | null = null;

/**
 * Get or create the singleton platform wallet manager instance
 */
export function getPlatformWalletManager(): PlatformWalletManager {
  if (!managerInstance) {
    managerInstance = new PlatformWalletManager();
  }
  return managerInstance;
}

/**
 * Initialize the platform wallet manager (convenience function)
 */
export async function initializePlatformWalletManager(): Promise<PlatformWalletManager> {
  const manager = getPlatformWalletManager();
  await manager.initialize();
  return manager;
}

/**
 * Get specific agent wallet (convenience function)
 */
export function getAgentWallet(type: AgentType): AgentWallet {
  const manager = getPlatformWalletManager();
  return manager.getAgentWallet(type);
}

/**
 * Get all agent addresses (convenience function)
 */
export function getAgentAddresses(): Record<AgentType, `0x${string}`> {
  const manager = getPlatformWalletManager();
  return manager.getAgentAddresses();
}
