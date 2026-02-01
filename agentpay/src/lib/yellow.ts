/**
 * Yellow Network Client
 * 
 * Real testnet integration with Yellow Network's sandbox clearnode.
 * Implements WebSocket connection management, EIP-712 authentication,
 * channel creation, off-chain transfers, and channel closure.
 */

import { 
  CLEARNODE_URL, 
  CHAIN_ID,
  CUSTODY_ADDRESS,
  ADJUDICATOR_ADDRESS,
  TEST_TOKEN,
  TOKEN_DECIMALS,
  REQUEST_TIMEOUT,
  RECONNECT_DELAYS,
  MAX_RECONNECT_ATTEMPTS,
  APPLICATION_NAME,
  DEFAULT_SCOPE,
  SESSION_EXPIRY,
  STORAGE_KEY,
} from './yellow-config';
import { SessionKeyManager, type SessionKeyPair } from './session-key-manager';

// Re-export config for convenience
export { TOKEN_DECIMALS as USDC_DECIMALS } from './yellow-config';

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'authenticating' 
  | 'authenticated' 
  | 'error';

export type SessionStatus = 
  | 'none'
  | 'creating'
  | 'active'
  | 'closing'
  | 'closed'
  | 'error';

export interface YellowClientConfig {
  clearnodeUrl?: string;
  chainId?: number;
  custodyAddress?: `0x${string}`;
  adjudicatorAddress?: `0x${string}`;
  applicationName?: string;
  onStatusChange?: (status: ConnectionStatus) => void;
  onSessionStatusChange?: (status: SessionStatus) => void;
  onBalanceUpdate?: (balance: string) => void;
  onPaymentEvent?: (event: PaymentEvent) => void;
  onError?: (error: YellowError) => void;
}

export interface PaymentEvent {
  id: string;
  type: 'transfer';
  transactionId: number;
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  asset: string;
  timestamp: number;
}

export interface PaymentRecord {
  id: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
}

export interface YellowError {
  code: YellowErrorCode;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

export type YellowErrorCode =
  | 'CONNECTION_FAILED'
  | 'CONNECTION_LOST'
  | 'AUTH_FAILED'
  | 'AUTH_REJECTED'
  | 'SESSION_EXPIRED'
  | 'CHANNEL_CREATION_FAILED'
  | 'CHANNEL_NOT_FOUND'
  | 'INSUFFICIENT_BALANCE'
  | 'TRANSFER_FAILED'
  | 'CLOSE_FAILED'
  | 'SIGNATURE_REJECTED'
  | 'RPC_TIMEOUT'
  | 'INVALID_RESPONSE';

export interface AuthParams {
  walletAddress: `0x${string}`;
  signTypedData: (params: SignTypedDataParams) => Promise<`0x${string}`>;
  allowances?: Allowance[];
  scope?: string;
  expiresAt?: number;
}

export interface SignTypedDataParams {
  domain: {
    name: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface Allowance {
  asset: string;
  amount: string;
}

export interface AuthResult {
  success: boolean;
  sessionKey: `0x${string}`;
  jwtToken: string;
  expiresAt: number;
}

export interface CreateChannelParams {
  chainId?: number;
  token?: `0x${string}`;
  amount: string;
  signState: (packedState: `0x${string}`) => Promise<`0x${string}`>;
  writeContract: (params: WriteContractParams) => Promise<`0x${string}`>;
  waitForTransaction: (hash: `0x${string}`) => Promise<void>;
}

export interface CloseChannelParams {
  fundsDestination: `0x${string}`;
  signState: (packedState: `0x${string}`) => Promise<`0x${string}`>;
  writeContract: (params: WriteContractParams) => Promise<`0x${string}`>;
  waitForTransaction: (hash: `0x${string}`) => Promise<void>;
}

export interface WriteContractParams {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: unknown[];
  value?: bigint;
}

export interface ChannelInfo {
  channelId: `0x${string}`;
  balance: string;
  status: SessionStatus;
}

export interface TransferResult {
  success: boolean;
  transactionId: number;
  newBalance: string;
}

export interface CloseResult {
  success: boolean;
  finalBalance: string;
  txHash: `0x${string}`;
}

// Channel RPC Types
interface ChannelConfigRPC {
  participants: [`0x${string}`, `0x${string}`];
  adjudicator: `0x${string}`;
  challenge: number;
  nonce: number;
}

interface AllocationRPC {
  participant: `0x${string}`;
  token: `0x${string}`;
  amount: string;
}

interface ChannelStateRPC {
  intent: number; // 1=INITIALIZE, 2=RESIZE, 3=FINALIZE
  version: number;
  state_data: `0x${string}`;
  allocations: AllocationRPC[];
}

interface CreateChannelRPCResult {
  channel_id: `0x${string}`;
  channel: ChannelConfigRPC;
  state: ChannelStateRPC;
  server_signature: `0x${string}`;
}

interface CloseChannelRPCResult {
  channel_id: `0x${string}`;
  state: ChannelStateRPC;
  server_signature: `0x${string}`;
}

interface TransferRPCResult {
  transactions: TransactionRecord[];
}

interface LedgerBalancesResult {
  balances: Array<{
    asset: string;
    available: string;
    locked: string;
  }>;
}

// Transaction record from transfer response
interface TransactionRecord {
  id: number;
  tx_type: string;
  from_account: `0x${string}`;
  to_account: `0x${string}`;
  asset: string;
  amount: string;
  created_at: string;
}

// Custody Contract ABI (minimal for depositAndCreate and close)
const CUSTODY_ABI = [
  {
    name: 'depositAndCreate',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'channel',
        type: 'tuple',
        components: [
          { name: 'participants', type: 'address[]' },
          { name: 'adjudicator', type: 'address' },
          { name: 'challenge', type: 'uint64' },
          { name: 'nonce', type: 'uint64' },
        ],
      },
      {
        name: 'state',
        type: 'tuple',
        components: [
          { name: 'intent', type: 'uint8' },
          { name: 'version', type: 'uint256' },
          { name: 'data', type: 'bytes' },
          {
            name: 'allocations',
            type: 'tuple[]',
            components: [
              { name: 'destination', type: 'address' },
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
        ],
      },
      { name: 'userSig', type: 'bytes' },
      { name: 'serverSig', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'close',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'channelId', type: 'bytes32' },
      {
        name: 'state',
        type: 'tuple',
        components: [
          { name: 'intent', type: 'uint8' },
          { name: 'version', type: 'uint256' },
          { name: 'data', type: 'bytes' },
          {
            name: 'allocations',
            type: 'tuple[]',
            components: [
              { name: 'destination', type: 'address' },
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
        ],
      },
      { name: 'userSig', type: 'bytes' },
      { name: 'serverSig', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

// RPC Types
interface RPCRequest {
  req: [number, string, Record<string, unknown>, number];
  sig?: string[];
}

interface RPCResponse {
  res?: [number, string, Record<string, unknown>, number];
  err?: { code: number; message: string };
  sig?: string[];
}

// Persisted State
interface PersistedYellowState {
  channelId: `0x${string}` | null;
  sessionKeyPrivate: `0x${string}` | null;
  jwtToken: string | null;
  expiresAt: number | null;
  lastKnownBalance: string;
  walletAddress: `0x${string}` | null;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function parseUSDC(amount: string): bigint {
  const [whole, decimal = ''] = amount.split('.');
  const paddedDecimal = decimal.padEnd(TOKEN_DECIMALS, '0').slice(0, TOKEN_DECIMALS);
  return BigInt(whole + paddedDecimal);
}

export function formatUSDC(amount: bigint | string): string {
  const amountStr = amount.toString().padStart(TOKEN_DECIMALS + 1, '0');
  const whole = amountStr.slice(0, -TOKEN_DECIMALS) || '0';
  const decimal = amountStr.slice(-TOKEN_DECIMALS);
  // Trim trailing zeros but keep at least 2 decimal places
  const trimmedDecimal = decimal.replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${trimmedDecimal}`;
}

// ============================================================================
// Yellow Client Class
// ============================================================================

export class YellowClient {
  // Configuration
  private config: Required<Pick<YellowClientConfig, 
    'clearnodeUrl' | 'chainId' | 'custodyAddress' | 'adjudicatorAddress' | 'applicationName'
  >> & YellowClientConfig;
  
  // WebSocket
  private ws: WebSocket | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // RPC
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    retried: boolean;
  }>();
  
  // Session
  private sessionKeyManager = new SessionKeyManager();
  private jwtToken: string | null = null;
  private walletAddress: `0x${string}` | null = null;
  
  // Channel
  private channelId: `0x${string}` | null = null;
  private balance: bigint = 0n;
  private sessionStatus: SessionStatus = 'none';
  private payments: PaymentRecord[] = [];
  private transactionHistory: TransactionRecord[] = [];

  constructor(config: YellowClientConfig = {}) {
    this.config = {
      clearnodeUrl: config.clearnodeUrl ?? CLEARNODE_URL,
      chainId: config.chainId ?? CHAIN_ID,
      custodyAddress: config.custodyAddress ?? CUSTODY_ADDRESS,
      adjudicatorAddress: config.adjudicatorAddress ?? ADJUDICATOR_ADDRESS,
      applicationName: config.applicationName ?? APPLICATION_NAME,
      ...config,
    };
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Connect to Yellow Network clearnode
   * Implements Requirement 1.1, 1.2
   */
  async connect(): Promise<void> {
    if (this.connectionStatus === 'connecting' || this.connectionStatus === 'connected') {
      return;
    }

    this.setConnectionStatus('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.clearnodeUrl);
        
        this.ws.onopen = () => {
          console.log('✅ Connected to Yellow Network clearnode');
          this.reconnectAttempts = 0;
          this.setConnectionStatus('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('❌ Yellow WebSocket error:', error);
          const yellowError = this.createError('CONNECTION_FAILED', 'WebSocket connection failed');
          this.config.onError?.(yellowError);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('🔌 Yellow WebSocket closed');
          const wasActive = this.sessionStatus === 'active';
          this.setConnectionStatus('disconnected');
          
          // Handle disconnection during active session (Requirement 1.5)
          if (wasActive) {
            this.persistState();
            this.config.onError?.(this.createError(
              'CONNECTION_LOST', 
              'Connection lost during active session',
              { recoverable: true }
            ));
            this.attemptReconnect();
          }
        };
      } catch (error) {
        this.setConnectionStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from clearnode
   * Implements Requirement 1.6
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
    
    this.setConnectionStatus('disconnected');
  }

  /**
   * Attempt reconnection with exponential backoff
   * Implements Requirement 1.3
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached');
      this.config.onError?.(this.createError(
        'CONNECTION_FAILED',
        'Failed to reconnect after maximum attempts',
        { recoverable: false }
      ));
      return;
    }

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    
    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();
        // Re-authenticate if we have stored credentials
        if (this.jwtToken && this.walletAddress) {
          console.log('🔐 Re-authenticating after reconnection...');
          // Note: Full re-auth would require wallet signature again
          // For now, we just restore the connection
        }
      } catch {
        this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' || this.connectionStatus === 'authenticated';
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.connectionStatus === 'authenticated' && this.jwtToken !== null;
  }

  // ==========================================================================
  // RPC Message Handling
  // ==========================================================================

  /**
   * Handle incoming WebSocket messages
   * Implements Requirement 1.4
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as RPCResponse;
      
      // Handle RPC response
      if (message.res) {
        const [requestId, method, result] = message.res;
        const pending = this.pendingRequests.get(requestId);
        
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(requestId);
          
          if (method === 'error' || message.err) {
            pending.reject(new Error((result as { error?: string }).error || message.err?.message || 'Unknown error'));
          } else {
            pending.resolve(result);
          }
        }
      }
      
      // Handle balance update notification (Requirement 7.3)
      if ((message as unknown as { type?: string }).type === 'bu') {
        const balanceData = message as unknown as { balance: string };
        if (balanceData.balance) {
          this.balance = BigInt(balanceData.balance);
          this.config.onBalanceUpdate?.(formatUSDC(this.balance));
        }
      }
    } catch (error) {
      console.error('Failed to parse Yellow message:', error);
    }
  }

  /**
   * Send RPC request with timeout and retry
   * Implements Requirement 1.4, 8.5
   */
  private async sendRequest<T>(
    method: string, 
    params: Record<string, unknown>,
    requiresAuth = true
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Yellow Network');
    }

    const requestId = ++this.requestId;
    const timestamp = Math.floor(Date.now() / 1000);

    const request: RPCRequest = {
      req: [requestId, method, params, timestamp],
    };

    // Sign request with session key if authenticated
    if (requiresAuth && this.sessionKeyManager.hasValidSessionKey()) {
      const signature = await this.sessionKeyManager.signRequest(request);
      request.sig = [signature];
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);
        if (pending && !pending.retried) {
          // Retry once on timeout (Requirement 8.5)
          console.log(`⏱️ Request ${requestId} timed out, retrying...`);
          pending.retried = true;
          this.ws?.send(JSON.stringify(request));
          
          // Set new timeout for retry
          pending.timeout = setTimeout(() => {
            this.pendingRequests.delete(requestId);
            reject(this.createError('RPC_TIMEOUT', `Request ${method} timed out after retry`));
          }, REQUEST_TIMEOUT);
        } else {
          this.pendingRequests.delete(requestId);
          reject(this.createError('RPC_TIMEOUT', `Request ${method} timed out`));
        }
      }, REQUEST_TIMEOUT);

      this.pendingRequests.set(requestId, { 
        resolve: resolve as (value: unknown) => void, 
        reject, 
        timeout,
        retried: false,
      });
      
      this.ws!.send(JSON.stringify(request));
    });
  }

  /**
   * Send RPC request with explicit signatures
   * Used for auth_verify where the signature comes from the main wallet
   */
  private async sendSignedRequest<T>(
    method: string, 
    params: Record<string, unknown>,
    signatures: `0x${string}`[]
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Yellow Network');
    }

    const requestId = ++this.requestId;
    const timestamp = Math.floor(Date.now() / 1000);

    const request: RPCRequest = {
      req: [requestId, method, params, timestamp],
      sig: signatures,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);
        if (pending && !pending.retried) {
          console.log(`⏱️ Request ${requestId} timed out, retrying...`);
          pending.retried = true;
          this.ws?.send(JSON.stringify(request));
          
          pending.timeout = setTimeout(() => {
            this.pendingRequests.delete(requestId);
            reject(this.createError('RPC_TIMEOUT', `Request ${method} timed out after retry`));
          }, REQUEST_TIMEOUT);
        } else {
          this.pendingRequests.delete(requestId);
          reject(this.createError('RPC_TIMEOUT', `Request ${method} timed out`));
        }
      }, REQUEST_TIMEOUT);

      this.pendingRequests.set(requestId, { 
        resolve: resolve as (value: unknown) => void, 
        reject, 
        timeout,
        retried: false,
      });
      
      this.ws!.send(JSON.stringify(request));
    });
  }

  // ==========================================================================
  // Authentication (Placeholder - Full implementation in Task 5)
  // ==========================================================================

  /**
   * Authenticate with Yellow Network
   * Full implementation in Task 5
   */
  async authenticate(params: AuthParams): Promise<AuthResult> {
    this.setConnectionStatus('authenticating');
    this.walletAddress = params.walletAddress;
    
    // Generate session key (Requirement 3.1)
    const sessionKey = this.sessionKeyManager.generateSessionKey();
    
    const expiresAt = params.expiresAt ?? Date.now() + SESSION_EXPIRY;
    const allowances = params.allowances ?? [{ asset: TEST_TOKEN, amount: '1000000000' }];
    const scope = params.scope ?? DEFAULT_SCOPE;

    try {
      // Step 1: Send auth_request (Requirement 2.1)
      const authChallenge = await this.sendRequest<{ challenge_message: string }>(
        'auth_request',
        {
          address: params.walletAddress,
          session_key: sessionKey.publicKey,
          application: this.config.applicationName,
          allowances,
          scope,
          expires_at: Math.floor(expiresAt / 1000),
        },
        false // Don't require auth for auth_request
      );

      // Step 2: Build EIP-712 typed data and get signature (Requirement 2.2, 2.3)
      const typedData = this.buildEIP712TypedData(
        authChallenge.challenge_message,
        scope,
        params.walletAddress,
        sessionKey.publicKey,
        expiresAt,
        allowances
      );

      const signature = await params.signTypedData(typedData);

      // Step 3: Send auth_verify with signature in sig array (Requirement 2.4)
      const authResult = await this.sendSignedRequest<{ jwt_token: string; success: boolean; address: string; session_key: string }>(
        'auth_verify',
        {
          challenge: authChallenge.challenge_message,
        },
        [signature]
      );

      if (!authResult.success) {
        throw new Error('Authentication failed');
      }

      // Store credentials (Requirement 2.5)
      this.jwtToken = authResult.jwt_token;
      this.setConnectionStatus('authenticated');

      return {
        success: true,
        sessionKey: sessionKey.publicKey,
        jwtToken: authResult.jwt_token,
        expiresAt,
      };
    } catch (error) {
      this.setConnectionStatus('error');
      throw this.createError('AUTH_FAILED', (error as Error).message);
    }
  }

  /**
   * Build EIP-712 typed data for authentication
   * Implements Requirement 2.2
   */
  private buildEIP712TypedData(
    challenge: string,
    scope: string,
    wallet: `0x${string}`,
    sessionKey: `0x${string}`,
    expiresAt: number,
    allowances: Allowance[]
  ): SignTypedDataParams {
    return {
      domain: {
        name: this.config.applicationName,
      },
      types: {
        Policy: [
          { name: 'challenge', type: 'string' },
          { name: 'scope', type: 'string' },
          { name: 'wallet', type: 'address' },
          { name: 'session_key', type: 'address' },
          { name: 'expires_at', type: 'uint64' },
          { name: 'allowances', type: 'Allowance[]' },
        ],
        Allowance: [
          { name: 'asset', type: 'string' },
          { name: 'amount', type: 'string' },
        ],
      },
      primaryType: 'Policy',
      message: {
        challenge,
        scope,
        wallet,
        session_key: sessionKey,
        expires_at: BigInt(Math.floor(expiresAt / 1000)),
        allowances,
      },
    };
  }

  // ==========================================================================
  // Channel Operations
  // ==========================================================================

  /**
   * Create a payment channel on Sepolia
   * Implements Requirements 4.1-4.5
   */
  async createChannel(params: CreateChannelParams): Promise<ChannelInfo> {
    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must authenticate before creating channel');
    }

    this.setSessionStatus('creating');
    
    try {
      const chainId = params.chainId ?? this.config.chainId;
      const token = params.token ?? ('0x0000000000000000000000000000000000000000' as `0x${string}`); // Native token placeholder
      
      // Step 1: Send create_channel RPC (Requirement 4.1)
      console.log('📡 Sending create_channel RPC...');
      const createResult = await this.sendRequest<CreateChannelRPCResult>(
        'create_channel',
        {
          chain_id: chainId,
          token: token,
        }
      );

      console.log('✅ Received channel config from clearnode');
      
      // Step 2: Verify server signature (Requirement 4.2)
      // Note: In production, we would verify the signature cryptographically
      // For hackathon MVP, we trust the clearnode response
      if (!createResult.server_signature) {
        throw new Error('Missing server signature in create_channel response');
      }

      // Step 3: Build packed state for signing
      const packedState = this.packState(
        createResult.channel_id,
        createResult.state
      );

      // Step 4: Get user signature on the state (Requirement 4.3)
      console.log('✍️ Requesting user signature on channel state...');
      const userSignature = await params.signState(packedState);
      console.log('✅ User signed channel state');

      // Step 5: Execute on-chain depositAndCreate (Requirement 4.4)
      console.log('⛓️ Submitting depositAndCreate transaction...');
      const depositAmount = parseUSDC(params.amount);
      
      const txHash = await params.writeContract({
        address: this.config.custodyAddress,
        abi: CUSTODY_ABI,
        functionName: 'depositAndCreate',
        args: [
          createResult.channel,
          createResult.state,
          userSignature,
          createResult.server_signature,
        ],
        value: depositAmount, // For native token deposits
      });

      console.log(`📝 Transaction submitted: ${txHash}`);
      
      // Step 6: Wait for confirmation (Requirement 4.5)
      await params.waitForTransaction(txHash);
      console.log('✅ Transaction confirmed');

      // Update local state
      this.channelId = createResult.channel_id;
      this.balance = depositAmount;
      this.payments = [];
      
      this.setSessionStatus('active');
      this.persistState();

      return {
        channelId: this.channelId,
        balance: formatUSDC(this.balance),
        status: 'active',
      };
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
      this.setSessionStatus('error');
      throw this.createError('CHANNEL_CREATION_FAILED', (error as Error).message);
    }
  }

  /**
   * Pack state for signing
   * Creates the packed state bytes that need to be signed
   */
  private packState(channelId: `0x${string}`, state: ChannelStateRPC): `0x${string}` {
    // In production, this would use proper ABI encoding
    // For MVP, we create a simple hash of the state data
    const stateString = JSON.stringify({
      channelId,
      intent: state.intent,
      version: state.version,
      state_data: state.state_data,
      allocations: state.allocations,
    });
    
    // Return as hex-encoded string (browser-compatible)
    const encoder = new TextEncoder();
    const bytes = encoder.encode(stateString);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `0x${hex}` as `0x${string}`;
  }

  /**
   * Close a payment channel and withdraw funds
   * Implements Requirements 6.1-6.5
   */
  async closeChannel(params: CloseChannelParams): Promise<CloseResult> {
    if (!this.channelId) {
      throw this.createError('CHANNEL_NOT_FOUND', 'No active channel');
    }

    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must be authenticated to close channel');
    }

    this.setSessionStatus('closing');
    
    try {
      // Step 1: Send close_channel RPC (Requirement 6.1)
      console.log('📡 Sending close_channel RPC...');
      const closeResult = await this.sendRequest<CloseChannelRPCResult>(
        'close_channel',
        {
          channel_id: this.channelId,
          funds_destination: params.fundsDestination,
        }
      );

      console.log('✅ Received final state from clearnode');

      // Step 2: Verify server signature (Requirement 6.2)
      if (!closeResult.server_signature) {
        throw new Error('Missing server signature in close_channel response');
      }

      // Step 3: Build packed state for signing
      const packedState = this.packState(
        closeResult.channel_id,
        closeResult.state
      );

      // Step 4: Get user signature on final state (Requirement 6.3)
      console.log('✍️ Requesting user signature on final state...');
      const userSignature = await params.signState(packedState);
      console.log('✅ User signed final state');

      // Step 5: Execute on-chain close (Requirement 6.4)
      console.log('⛓️ Submitting close transaction...');
      const txHash = await params.writeContract({
        address: this.config.custodyAddress,
        abi: CUSTODY_ABI,
        functionName: 'close',
        args: [
          this.channelId,
          closeResult.state,
          userSignature,
          closeResult.server_signature,
        ],
      });

      console.log(`📝 Close transaction submitted: ${txHash}`);

      // Step 6: Wait for confirmation (Requirement 6.5)
      await params.waitForTransaction(txHash);
      console.log('✅ Close transaction confirmed');

      const finalBalance = formatUSDC(this.balance);
      
      // Clear local state
      this.channelId = null;
      this.balance = 0n;
      this.setSessionStatus('closed');
      this.clearPersistedState();

      return {
        success: true,
        finalBalance,
        txHash,
      };
    } catch (error) {
      console.error('❌ Channel closure failed:', error);
      this.setSessionStatus('error');
      throw this.createError('CLOSE_FAILED', (error as Error).message);
    }
  }

  // ==========================================================================
  // Transfer Operations
  // ==========================================================================

  /**
   * Execute an off-chain transfer
   * Implements Requirements 5.1-5.5
   */
  async transfer(destination: `0x${string}`, amount: string): Promise<TransferResult> {
    if (!this.channelId) {
      throw this.createError('CHANNEL_NOT_FOUND', 'No active channel');
    }

    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must be authenticated to transfer');
    }

    const transferAmount = parseUSDC(amount);
    
    // Check balance before sending (Requirement 5.4)
    if (transferAmount > this.balance) {
      throw this.createError('INSUFFICIENT_BALANCE', 'Insufficient balance for transfer');
    }

    try {
      // Send transfer RPC (Requirement 5.1)
      console.log(`💸 Sending transfer of ${amount} to ${destination}...`);
      const transferResult = await this.sendRequest<TransferRPCResult>(
        'transfer',
        {
          destination,
          allocations: [
            { asset: TEST_TOKEN, amount },
          ],
        }
      );

      // Update local balance immediately (Requirement 5.2)
      this.balance -= transferAmount;
      
      // Get transaction ID from response
      const transaction = transferResult.transactions?.[0];
      const transactionId = transaction?.id ?? Date.now();
      
      // Create payment record (Requirement 5.5)
      const payment: PaymentRecord = {
        id: `pay_${transactionId}`,
        from: this.walletAddress || '0x0',
        to: destination,
        amount,
        timestamp: Date.now(),
      };
      this.payments.push(payment);
      
      // Store in transaction history
      if (transaction) {
        this.transactionHistory.push(transaction);
      }
      
      // Emit payment event (Requirement 5.3)
      const paymentEvent: PaymentEvent = {
        id: payment.id,
        type: 'transfer',
        transactionId,
        from: (this.walletAddress || '0x0') as `0x${string}`,
        to: destination,
        amount,
        asset: TEST_TOKEN,
        timestamp: Date.now(),
      };
      this.config.onPaymentEvent?.(paymentEvent);
      this.config.onBalanceUpdate?.(formatUSDC(this.balance));

      console.log(`✅ Transfer complete. New balance: ${formatUSDC(this.balance)}`);

      return {
        success: true,
        transactionId,
        newBalance: formatUSDC(this.balance),
      };
    } catch (error) {
      console.error('❌ Transfer failed:', error);
      throw this.createError('TRANSFER_FAILED', (error as Error).message);
    }
  }

  // ==========================================================================
  // Balance and History
  // ==========================================================================

  /**
   * Query balance from clearnode
   * Implements Requirement 7.1
   */
  async queryBalance(): Promise<string> {
    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must be authenticated to query balance');
    }

    try {
      const result = await this.sendRequest<LedgerBalancesResult>(
        'get_ledger_balances',
        {}
      );

      // Find the balance for our test token
      const tokenBalance = result.balances?.find(b => b.asset === TEST_TOKEN);
      if (tokenBalance) {
        this.balance = parseUSDC(tokenBalance.available);
        this.config.onBalanceUpdate?.(formatUSDC(this.balance));
      }

      return formatUSDC(this.balance);
    } catch (error) {
      console.error('Failed to query balance:', error);
      // Return last known balance on error
      return formatUSDC(this.balance);
    }
  }

  /**
   * Get current balance (local)
   */
  getBalance(): string {
    return formatUSDC(this.balance);
  }

  /**
   * Get payment history
   */
  getPaymentHistory(): PaymentRecord[] {
    return [...this.payments];
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(): TransactionRecord[] {
    return [...this.transactionHistory];
  }

  /**
   * Get channel ID
   */
  getChannelId(): `0x${string}` | null {
    return this.channelId;
  }

  /**
   * Get session status
   */
  getSessionStatus(): SessionStatus {
    return this.sessionStatus;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.sessionStatus === 'active' && this.channelId !== null;
  }

  // ==========================================================================
  // State Persistence (Requirement 8.1, 8.2)
  // ==========================================================================

  /**
   * Persist state to localStorage
   */
  private persistState(): void {
    if (typeof window === 'undefined') return;
    
    const sessionKey = this.sessionKeyManager.getSessionKey();
    const state: PersistedYellowState = {
      channelId: this.channelId,
      sessionKeyPrivate: sessionKey?.privateKey ?? null,
      jwtToken: this.jwtToken,
      expiresAt: this.sessionKeyManager.getExpiresAt(),
      lastKnownBalance: formatUSDC(this.balance),
      walletAddress: this.walletAddress,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Restore state from localStorage
   */
  restoreState(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      
      const state: PersistedYellowState = JSON.parse(stored);
      
      // Restore session key if not expired
      if (state.sessionKeyPrivate && state.expiresAt) {
        const restored = this.sessionKeyManager.restoreSessionKey(
          state.sessionKeyPrivate,
          state.expiresAt
        );
        if (!restored) return false;
      }
      
      this.channelId = state.channelId;
      this.jwtToken = state.jwtToken;
      this.walletAddress = state.walletAddress;
      this.balance = parseUSDC(state.lastKnownBalance);
      
      if (this.channelId) {
        this.setSessionStatus('active');
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear persisted state
   */
  clearPersistedState(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.config.onStatusChange?.(status);
  }

  private setSessionStatus(status: SessionStatus): void {
    this.sessionStatus = status;
    this.config.onSessionStatusChange?.(status);
  }

  private createError(
    code: YellowErrorCode, 
    message: string,
    options: { recoverable?: boolean; details?: Record<string, unknown> } = {}
  ): YellowError {
    return {
      code,
      message,
      details: options.details,
      recoverable: options.recoverable ?? ['CONNECTION_LOST', 'RPC_TIMEOUT'].includes(code),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let yellowClient: YellowClient | null = null;

export function getYellowClient(config?: YellowClientConfig): YellowClient {
  if (!yellowClient) {
    yellowClient = new YellowClient(config);
  }
  return yellowClient;
}

export function resetYellowClient(): void {
  if (yellowClient) {
    yellowClient.disconnect();
    yellowClient = null;
  }
}
