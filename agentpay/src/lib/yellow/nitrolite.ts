/**
 * Nitrolite SDK Client
 * 
 * Uses the official @erc7824/nitrolite SDK for proper on-chain channel operations.
 * Based on the reference implementation from my-yellow-app-main/index.ts
 */

import {
  NitroliteClient,
  WalletStateSigner,
  createECDSAMessageSigner,
  createEIP712AuthMessageSigner,
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createCreateChannelMessage,
  createResizeChannelMessage,
  createCloseChannelMessage,
  createGetChannelsMessage,
  createGetLedgerBalancesMessage,
  createTransferMessage,
} from '@erc7824/nitrolite';
import { createPublicClient, http, type WalletClient } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  CLEARNODE_URL,
  CHAIN_ID,
  CUSTODY_ADDRESS,
  ADJUDICATOR_ADDRESS,
  TEST_TOKEN_ADDRESS,
  TEST_TOKEN,
} from './config';

// ============================================================================
// Types
// ============================================================================

export type NitroliteStage =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'checking_channels'
  | 'creating_channel'
  | 'waiting_index'
  | 'resizing_channel'
  | 'channel_active'
  | 'closing_channel'
  | 'transferring'
  | 'complete'
  | 'error';

export interface NitroliteConfig {
  onStageChange?: (stage: NitroliteStage, message?: string) => void;
  onTransactionSubmitted?: (txHash: string, type: 'create' | 'close') => void;
  onError?: (error: Error) => void;
}

export interface ChannelResult {
  channelId: string;
  txHash: string;
  balance: string;
}

// ============================================================================
// Nitrolite SDK Client Class
// ============================================================================

export class NitroliteSDKClient {
  private ws: WebSocket | null = null;
  private nitroliteClient: NitroliteClient | null = null;
  private sessionSigner: ReturnType<typeof createECDSAMessageSigner> | null = null;
  private sessionAddress: string | null = null;
  private walletClient: WalletClient | null = null;
  private userAddress: `0x${string}` | null = null;
  private _isAuthenticated = false;
  private currentChannelId: string | null = null;
  
  private config: NitroliteConfig;
  private stage: NitroliteStage = 'idle';

  constructor(config: NitroliteConfig = {}) {
    this.config = config;
  }

  private setStage(stage: NitroliteStage, message?: string): void {
    this.stage = stage;
    this.config.onStageChange?.(stage, message);
    console.log(`📍 Nitrolite stage: ${stage}${message ? ` - ${message}` : ''}`);
  }

  getStage(): NitroliteStage {
    return this.stage;
  }

  isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  /**
   * Initialize the client with a wallet client from wagmi
   */
  async initialize(walletClient: WalletClient, userAddress: `0x${string}`): Promise<void> {
    this.setStage('connecting', 'Initializing Nitrolite client...');
    
    this.walletClient = walletClient;
    this.userAddress = userAddress;

    // Create public client for reading chain state
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });

    // Initialize NitroliteClient with WalletStateSigner
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.nitroliteClient = new NitroliteClient({
      publicClient,
      walletClient: walletClient as any,
      stateSigner: new WalletStateSigner(walletClient as any),
      addresses: {
        custody: CUSTODY_ADDRESS,
        adjudicator: ADJUDICATOR_ADDRESS,
      },
      chainId: CHAIN_ID,
      challengeDuration: 3600n,
    });

    // Generate session key for RPC signing
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    this.sessionAddress = sessionAccount.address;
    this.sessionSigner = createECDSAMessageSigner(sessionPrivateKey);

    // Connect WebSocket
    await this.connectWebSocket();
    
    console.log('✅ Nitrolite client initialized');
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(CLEARNODE_URL);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket closed');
      };
    });
  }

  /**
   * Check if WebSocket is open and ready
   */
  private isWebSocketOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Ensure the WebSocket is connected and authenticated.
   * Reconnects + re-authenticates if the connection was dropped.
   */
  private async ensureConnection(): Promise<void> {
    if (this.isWebSocketOpen()) {
      return; // Connection is fine
    }

    console.log('🔄 WebSocket closed, reconnecting...');
    
    // Reconnect
    await this.connectWebSocket();
    
    // Re-authenticate if we were previously authenticated
    if (this._isAuthenticated && this.sessionSigner && this.sessionAddress && this.userAddress && this.walletClient) {
      console.log('🔐 Re-authenticating after reconnect...');
      await this.authenticate();
      console.log('✅ Re-authenticated successfully');
    }
  }

  /**
   * Authenticate with Yellow Network
   */
  async authenticate(): Promise<void> {
    if (!this.ws || !this.sessionSigner || !this.sessionAddress || !this.userAddress || !this.walletClient) {
      throw new Error('Client not initialized');
    }

    this.setStage('authenticating', 'Authenticating with Yellow Network...');

    return new Promise(async (resolve, reject) => {
      const authParams = {
        session_key: this.sessionAddress as `0x${string}`,
        allowances: [{ asset: TEST_TOKEN, amount: '1000000000' }],
        expires_at: BigInt(Math.floor(Date.now() / 1000) + 3600),
        scope: 'console',
      };

      const handler = async (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);
          const type = response.res?.[1];

          if (type === 'auth_challenge') {
            console.log('📝 Received auth challenge');
            const challenge = response.res[2].challenge_message;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const signer = createEIP712AuthMessageSigner(
              this.walletClient as any,
              authParams,
              { name: 'Yellow Clearnet' }
            );
            const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challenge);
            this.ws?.send(verifyMsg);
          }

          if (type === 'auth_verify') {
            console.log('✅ Authentication successful');
            this._isAuthenticated = true;
            this.ws?.removeEventListener('message', handler);
            resolve();
          }

          if (response.error) {
            console.error('❌ Auth error:', response.error);
            this.ws?.removeEventListener('message', handler);
            reject(new Error(response.error.message || 'Authentication failed'));
          }
        } catch (err) {
          reject(err);
        }
      };

      if (this.ws) {
        this.ws.addEventListener('message', handler);
      }

      // Send auth request
      const authRequestMsg = await createAuthRequestMessage({
        address: this.userAddress!,
        application: 'Yellow Clearnet',
        ...authParams,
      });
      if (this.ws) {
        this.ws.send(authRequestMsg);
      }
    });
  }

  /**
   * Get unified balance
   */
  async getUnifiedBalance(): Promise<string> {
    if (!this.ws || !this.sessionSigner || !this.userAddress) {
      throw new Error('Client not initialized or not authenticated');
    }

    return new Promise(async (resolve) => {
      const handler = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        if (msg.res && msg.res[1] === 'get_ledger_balances') {
          const balances = msg.res[2].ledger_balances || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bal = balances.find((b: any) => b.asset === TEST_TOKEN);
          this.ws?.removeEventListener('message', handler);
          resolve(bal ? bal.amount : '0');
        }
      };
      this.ws!.addEventListener('message', handler);

      const msg = await createGetLedgerBalancesMessage(this.sessionSigner!, this.userAddress!);
      this.ws!.send(msg);
    });
  }

  /**
   * Get existing channels
   */
  async getChannels(): Promise<Array<{ channel_id: string; status: string; amount?: string }>> {
    if (!this.ws || !this.sessionSigner || !this.userAddress) {
      throw new Error('Client not initialized');
    }

    return new Promise(async (resolve) => {
      const handler = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        if (msg.res && (msg.res[1] === 'channels' || msg.res[1] === 'get_channels')) {
          this.ws?.removeEventListener('message', handler);
          resolve(msg.res[2].channels || []);
        }
      };
      this.ws!.addEventListener('message', handler);

      const msg = await createGetChannelsMessage(this.sessionSigner!, this.userAddress!);
      this.ws!.send(msg);
    });
  }

  /**
   * Create and fund a channel using the full on-chain lifecycle
   * 
   * Flow:
   * 1. Send create_channel RPC
   * 2. Submit on-chain depositAndCreate via NitroliteClient
   * 3. Wait 25s for Node indexing
   * 4. Send resize_channel RPC to fund from unified balance
   */
  async createAndFundChannel(amount: string): Promise<ChannelResult> {
    if (!this.ws || !this.sessionSigner || !this.nitroliteClient || !this.userAddress) {
      throw new Error('Client not initialized');
    }

    this.setStage('creating_channel', 'Creating channel on-chain...');

    return new Promise(async (resolve, reject) => {
      let channelId: string | null = null;
      let createTxHash: string | null = null;

      const handler = async (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          const type = msg.res?.[1];

          // Handle create_channel response
          if (type === 'create_channel') {
            const { channel_id, channel, state, server_signature } = msg.res[2];
            channelId = channel_id;
            console.log(`📋 Channel prepared: ${channel_id}`);

            // Build unsigned initial state for on-chain submission
            const unsignedInitialState = {
              intent: state.intent,
              version: BigInt(state.version),
              data: state.state_data || '0x',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              allocations: state.allocations.map((a: any) => ({
                destination: a.destination,
                token: a.token,
                amount: BigInt(a.amount),
              })),
            };

            // Submit on-chain via NitroliteClient
            console.log('⛓️ Submitting depositAndCreate on-chain...');
            try {
              const res = await this.nitroliteClient!.createChannel({
                channel,
                unsignedInitialState,
                serverSignature: server_signature,
              });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              createTxHash = typeof res === 'string' ? res : (res as any).txHash;
              console.log(`✅ Channel created on-chain: ${createTxHash}`);
              this.config.onTransactionSubmitted?.(createTxHash!, 'create');

              // Wait for Node indexing
              this.setStage('waiting_index', 'Waiting 25s for Node to index channel...');
              await this.delay(25000);

              // Resize to fund from unified balance
              this.setStage('resizing_channel', 'Funding channel from unified balance...');
              const resizeMsg = await createResizeChannelMessage(this.sessionSigner!, {
                channel_id: channel_id as `0x${string}`,
                allocate_amount: BigInt(Math.floor(parseFloat(amount) * 1_000_000)),
                funds_destination: this.userAddress!,
              });
              this.ws?.send(resizeMsg);
            } catch (err) {
              console.error('❌ On-chain channel creation failed:', err);
              this.ws?.removeEventListener('message', handler);
              reject(err);
            }
          }

          // Handle resize_channel response
          if (type === 'resize_channel') {
            console.log('✅ Channel funded from unified balance');
            this.currentChannelId = channelId;
            this.setStage('channel_active', 'Channel ready for payments');
            this.ws?.removeEventListener('message', handler);
            resolve({
              channelId: channelId!,
              txHash: createTxHash!,
              balance: amount,
            });
          }

          // Handle errors — only for create/resize operations, ignore unrelated errors
          if (type === 'error' || msg.error) {
            const errorMsg = msg.res?.[2]?.error || msg.error?.message || 'Unknown error';
            // Ignore "message validation failed" — these come from unrelated messages
            if (errorMsg === 'message validation failed') {
              console.warn('⚠️ Ignoring message validation error (likely unrelated)');
              return;
            }
            console.error('❌ Error:', errorMsg);
            this.ws?.removeEventListener('message', handler);
            reject(new Error(errorMsg));
          }
        } catch (err) {
          reject(err);
        }
      };

      if (this.ws) {
        this.ws.addEventListener('message', handler);
      }

      // Send create_channel RPC
      const createMsg = await createCreateChannelMessage(this.sessionSigner!, {
        chain_id: CHAIN_ID,
        token: TEST_TOKEN_ADDRESS,
      });
      if (this.ws) {
        this.ws.send(createMsg);
      }
    });
  }

  /**
   * Close channel and settle on-chain
   */
  async closeChannel(): Promise<{ txHash: string; finalBalance: string }> {
    if (!this.sessionSigner || !this.nitroliteClient || !this.userAddress || !this.currentChannelId) {
      throw new Error('No active channel to close');
    }

    // Reconnect + re-auth if WebSocket was dropped
    await this.ensureConnection();

    this.setStage('closing_channel', 'Closing channel on-chain...');

    return new Promise(async (resolve, reject) => {
      const handler = async (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          const type = msg.res?.[1];

          if (type === 'close_channel') {
            const { channel_id, state, server_signature } = msg.res[2];
            console.log(`📋 Node signed close for ${channel_id}`);

            // Build final state for on-chain close
            const finalState = {
              intent: state.intent,
              version: BigInt(state.version),
              data: state.state_data || state.data || '0x',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              allocations: state.allocations.map((a: any) => ({
                destination: a.destination,
                token: a.token,
                amount: BigInt(a.amount),
              })),
              channelId: channel_id,
              serverSignature: server_signature,
            };

            // Submit on-chain close
            console.log('⛓️ Submitting close on-chain...');
            try {
              const txHash = await this.nitroliteClient!.closeChannel({
                finalState,
                stateData: '0x',
              });
              console.log(`✅ Channel closed on-chain: ${txHash}`);
              this.config.onTransactionSubmitted?.(txHash as string, 'close');

              // Calculate final balance from allocations
              const userAllocation = state.allocations.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (a: any) => a.destination.toLowerCase() === this.userAddress!.toLowerCase()
              );
              const finalBalance = userAllocation ? (Number(userAllocation.amount) / 1_000_000).toFixed(2) : '0';

              this.currentChannelId = null;
              this.setStage('complete', 'Channel closed and settled');
              this.ws?.removeEventListener('message', handler);
              resolve({ txHash: txHash as string, finalBalance });
            } catch (err) {
              console.error('❌ On-chain close failed:', err);
              this.ws?.removeEventListener('message', handler);
              reject(err);
            }
          }

          if (type === 'error' || msg.error) {
            const errorMsg = msg.res?.[2]?.error || msg.error?.message || 'Unknown error';
            if (errorMsg === 'message validation failed') {
              console.warn('⚠️ Ignoring message validation error (likely unrelated)');
              return;
            }
            console.error('❌ Error:', errorMsg);
            this.ws?.removeEventListener('message', handler);
            reject(new Error(errorMsg));
          }
        } catch (err) {
          reject(err);
        }
      };

      if (this.ws) {
        this.ws.addEventListener('message', handler);
      }

      // Send close_channel RPC
      const closeMsg = await createCloseChannelMessage(
        this.sessionSigner!,
        this.currentChannelId as `0x${string}`,
        this.userAddress!
      );
      if (this.ws) {
        this.ws.send(closeMsg);
      }
    });
  }

  /**
   * Transfer funds (off-chain)
   */
  async transfer(destination: `0x${string}`, amount: string): Promise<{ transactionId: number }> {
    if (!this.sessionSigner) {
      throw new Error('Client not initialized');
    }

    // Reconnect + re-auth if WebSocket was dropped
    await this.ensureConnection();

    return new Promise(async (resolve, reject) => {
      const handler = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        const type = msg.res?.[1];

        if (type === 'transfer') {
          const transactions = msg.res[2].transactions || [];
          const txId = transactions[0]?.id || Date.now();
          console.log(`✅ Transfer complete. TX ID: ${txId}`);
          this.ws?.removeEventListener('message', handler);
          resolve({ transactionId: txId });
        }

        if (type === 'error' || msg.error) {
          const errorMsg = msg.res?.[2]?.error || msg.error?.message || 'Transfer failed';
          if (errorMsg === 'message validation failed') {
            console.warn('⚠️ Ignoring message validation error in transfer');
            return;
          }
          this.ws?.removeEventListener('message', handler);
          reject(new Error(errorMsg));
        }
      };

      this.ws!.addEventListener('message', handler);

      const transferMsg = await createTransferMessage(this.sessionSigner!, {
        destination,
        allocations: [{ asset: TEST_TOKEN, amount }],
      });
      this.ws!.send(transferMsg);
    });
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isAuthenticated = false;
    this.currentChannelId = null;
    this.setStage('idle');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let nitroliteClientInstance: NitroliteSDKClient | null = null;

export function getNitroliteClient(config?: NitroliteConfig): NitroliteSDKClient {
  if (!nitroliteClientInstance) {
    nitroliteClientInstance = new NitroliteSDKClient(config);
  }
  return nitroliteClientInstance;
}

export function resetNitroliteClient(): void {
  if (nitroliteClientInstance) {
    nitroliteClientInstance.disconnect();
    nitroliteClientInstance = null;
  }
}
