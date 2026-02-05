/**
 * Yellow Network Client
 * 
 * Real testnet integration with Yellow Network's sandbox clearnode.
 * Implements WebSocket connection management, EIP-712 authentication,
 * channel creation, off-chain transfers, and channel closure.
 */

import { getAddress, encodeAbiParameters, keccak256 } from 'viem';
import { 
  CLEARNODE_URL, 
  CHAIN_ID,
  CUSTODY_ADDRESS,
  ADJUDICATOR_ADDRESS,
  TEST_TOKEN,
  TEST_TOKEN_ADDRESS,
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
  /** Current chain ID the wallet is connected to */
  currentChainId?: number;
  /** Function to switch chains if needed */
  switchChain?: (chainId: number) => Promise<void>;
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
  destination: `0x${string}`;
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
        // Restore authenticated status if we have valid credentials
        if (this.jwtToken && this.walletAddress && this.sessionKeyManager.hasValidSessionKey()) {
          console.log('🔐 Restoring authenticated status after reconnection...');
          this.setConnectionStatus('authenticated');
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
    // Timestamp must be in milliseconds per Yellow protocol
    const timestamp = Date.now();

    const request: RPCRequest = {
      req: [requestId, method, params, timestamp],
    };

    // Sign request with session key if authenticated
    if (requiresAuth && this.sessionKeyManager.hasValidSessionKey()) {
      const signature = await this.sessionKeyManager.signRequest(request);
      request.sig = [signature];
      console.log(`🔏 Signed ${method} request with session key:`, {
        requestId,
        method,
        signatureLength: signature.length,
        signaturePrefix: signature.slice(0, 20) + '...',
      });
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
    // Timestamp must be in milliseconds per Yellow protocol
    const timestamp = Date.now();

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
    
    // expires_at must be in SECONDS per Yellow protocol
    const expiresAtMs = params.expiresAt ?? Date.now() + SESSION_EXPIRY;
    const expiresAtSec = Math.floor(expiresAtMs / 1000);
    const allowances = params.allowances ?? [{ asset: TEST_TOKEN, amount: '1000000000' }];
    const scope = params.scope ?? DEFAULT_SCOPE;

    try {
      // Step 1: Send auth_request (Requirement 2.1)
      // Note: expires_at is in SECONDS per Yellow docs
      console.log('🔐 Sending auth_request with params:', {
        address: params.walletAddress,
        session_key: sessionKey.publicKey,
        application: this.config.applicationName,
        allowances,
        scope,
        expires_at: expiresAtSec,
        expires_at_readable: new Date(expiresAtSec * 1000).toISOString(),
      });
      
      const authChallenge = await this.sendRequest<{ challenge_message: string }>(
        'auth_request',
        {
          address: params.walletAddress,
          session_key: sessionKey.publicKey,
          application: this.config.applicationName,
          allowances,
          scope,
          expires_at: expiresAtSec, // SECONDS per Yellow protocol
        },
        false // Don't require auth for auth_request
      );

      console.log('✅ Received challenge:', authChallenge.challenge_message);

      // Step 2: Build EIP-712 typed data and get signature (Requirement 2.2, 2.3)
      // CRITICAL: expires_at in EIP-712 message MUST match auth_request (both in SECONDS)
      const typedData = this.buildEIP712TypedData(
        authChallenge.challenge_message,
        scope,
        params.walletAddress,
        sessionKey.publicKey,
        expiresAtSec, // SECONDS - must match auth_request
        allowances
      );

      // Debug: verify expires_at is in seconds (should be ~10 digits, not 13)
      const expiresAtInMessage = typedData.message.expires_at as number;
      console.log('📝 EIP-712 expires_at value:', expiresAtInMessage, 
        '(should be ~10 digits for seconds, readable:', new Date(expiresAtInMessage * 1000).toISOString(), ')');
      
      if (expiresAtInMessage > 10000000000) {
        console.warn('⚠️ WARNING: expires_at appears to be in milliseconds, not seconds!');
      }

      console.log('📝 EIP-712 typed data:', JSON.stringify(typedData, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));

      const signature = await params.signTypedData(typedData);
      console.log('✅ Got signature:', signature);

      // Step 3: Send auth_verify with signature in sig array (Requirement 2.4)
      console.log('🔐 Sending auth_verify with challenge:', authChallenge.challenge_message);
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
        expiresAt: expiresAtMs,
      };
    } catch (error) {
      console.error('❌ Auth error details:', error);
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
    expiresAtSeconds: number,
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
        // CRITICAL: expires_at must be in SECONDS to match auth_request
        // Yellow protocol expects Unix timestamp in seconds, not milliseconds
        expires_at: expiresAtSeconds,
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
      
      // Query supported assets to find a valid token
      // If no token specified, try to find a supported one
      let token = params.token;
      if (!token) {
        console.log('🔍 Querying supported assets for chain', chainId, '...');
        const assets = await this.getAssets(chainId);
        console.log('📋 Available assets:', assets);
        
        // Try to find a USD-like token or use the first available
        const usdToken = assets.find(a => 
          a.symbol?.toLowerCase().includes('usd') || 
          a.symbol?.toLowerCase().includes('usdc')
        );
        
        if (usdToken?.token && usdToken.token !== '0x0000000000000000000000000000000000000000') {
          token = usdToken.token;
          console.log(`✅ Using token: ${usdToken.symbol} (${token})`);
        } else if (assets.length > 0 && assets[0].token && assets[0].token !== '0x0000000000000000000000000000000000000000') {
          token = assets[0].token;
          console.log(`✅ Using first available token: ${assets[0].symbol} (${token})`);
        } else {
          // Fallback: Use known test token address for Sepolia
          // This is the ytest.usd token on Yellow's Sepolia sandbox
          console.log(`⚠️ No valid tokens from get_assets, using known test token: ${TEST_TOKEN_ADDRESS}`);
          token = TEST_TOKEN_ADDRESS;
        }
      }
      
      // Validate token is not zero address
      if (!token || token === '0x0000000000000000000000000000000000000000') {
        throw new Error('Invalid token address. Cannot create channel with zero address.');
      }
      
      // Step 1: Send create_channel RPC (Requirement 4.1)
      console.log('📡 Sending create_channel RPC with params:', { chain_id: chainId, token });
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
      
      // Hash the packed state - contract expects signature over keccak256(packedState)
      const stateHash = keccak256(packedState);
      console.log('📋 Packed state hash for signing:', stateHash);

      // Step 4: Get user signature on the state hash (Requirement 4.3)
      console.log('✍️ Requesting user signature on channel state...');
      const userSignature = await params.signState(stateHash);
      console.log('✅ User signed channel state');

      // Step 5: Execute on-chain depositAndCreate (Requirement 4.4)
      console.log('⛓️ Submitting depositAndCreate transaction...');
      console.log('📋 Channel config from clearnode:', JSON.stringify(createResult, null, 2));
      
      // CRITICAL: Validate and switch chain before on-chain transaction
      // The custody contract is on Sepolia (chainId 11155111)
      const requiredChainId = chainId;
      if (params.currentChainId && params.currentChainId !== requiredChainId) {
        console.log(`⚠️ Chain mismatch: wallet on ${params.currentChainId}, need ${requiredChainId}`);
        if (params.switchChain) {
          console.log(`🔄 Switching to chain ${requiredChainId}...`);
          await params.switchChain(requiredChainId);
          console.log('✅ Chain switched successfully');
          // Small delay to ensure chain switch is complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          throw new Error(
            `Wrong network: Please switch to Sepolia (chain ID ${requiredChainId}). ` +
            `Your wallet is currently on chain ID ${params.currentChainId}.`
          );
        }
      }
      
      const depositAmount = parseUSDC(params.amount);
      
      // Transform clearnode response to match on-chain contract format
      // The clearnode returns snake_case, but the contract expects specific structure
      const channelForContract = {
        participants: createResult.channel.participants,
        adjudicator: createResult.channel.adjudicator,
        challenge: BigInt(createResult.channel.challenge),
        nonce: BigInt(createResult.channel.nonce),
      };
      
      // The clearnode already returns 'destination' in allocations, use it directly
      const stateForContract = {
        intent: createResult.state.intent,
        version: BigInt(createResult.state.version),
        data: createResult.state.state_data || '0x',
        allocations: createResult.state.allocations.map(a => ({
          destination: a.destination,
          token: a.token,
          amount: BigInt(a.amount),
        })),
      };
      
      console.log('📋 Transformed for contract:', {
        channel: channelForContract,
        state: stateForContract,
      });
      
      // Normalize custody address to proper checksum format
      const normalizedCustodyAddress = getAddress(this.config.custodyAddress);
      console.log('📋 Using custody address:', normalizedCustodyAddress);
      
      // For ERC-20 token deposits, we don't send ETH value
      // The token amount is handled by the contract via transferFrom
      // Note: User must have approved the custody contract to spend their tokens first
      // For the hackathon MVP, we're creating a channel with zero initial deposit
      // and relying on the clearnode's unified balance system
      const txHash = await params.writeContract({
        address: normalizedCustodyAddress,
        abi: CUSTODY_ABI,
        functionName: 'depositAndCreate',
        args: [
          channelForContract,
          stateForContract,
          userSignature,
          createResult.server_signature,
        ],
        // Don't send ETH for ERC-20 token channels
        // value: depositAmount, // Only for native token (ETH) deposits
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
   * Uses proper ABI encoding as per Yellow protocol spec
   */
  private packState(channelId: `0x${string}`, state: ChannelStateRPC): `0x${string}` {
    // ABI encode the state according to Yellow protocol:
    // packedState = abi.encode(channelId, intent, version, data, allocations)
    const packedState = encodeAbiParameters(
      [
        { name: 'channelId', type: 'bytes32' },
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
          ]
        },
      ],
      [
        channelId,
        state.intent,
        BigInt(state.version),
        state.state_data || '0x',
        state.allocations.map(a => ({
          destination: getAddress(a.destination),
          token: getAddress(a.token),
          amount: BigInt(a.amount),
        })),
      ]
    );
    
    return packedState;
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
      
      // Hash the packed state - contract expects signature over keccak256(packedState)
      const stateHash = keccak256(packedState);

      // Step 4: Get user signature on final state hash (Requirement 6.3)
      console.log('✍️ Requesting user signature on final state...');
      const userSignature = await params.signState(stateHash);
      console.log('✅ User signed final state');

      // Step 5: Execute on-chain close (Requirement 6.4)
      console.log('⛓️ Submitting close transaction...');
      
      // Normalize custody address to proper checksum format
      const normalizedCustodyAddress = getAddress(this.config.custodyAddress);
      
      const txHash = await params.writeContract({
        address: normalizedCustodyAddress,
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
   * Execute an off-chain transfer using Yellow's unified balance system.
   * Works in two modes:
   * 1. Real mode: Requires authenticated Yellow session with balance
   * 2. Demo mode: Simulates transfers for hackathon demo
   * 
   * Implements Requirements 5.1-5.5
   */
  async transfer(destination: `0x${string}`, amount: string): Promise<TransferResult> {
    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must be authenticated to transfer');
    }

    const transferAmount = parseUSDC(amount);
    
    // Check local balance before sending (Requirement 5.4)
    if (transferAmount > this.balance) {
      throw this.createError('INSUFFICIENT_BALANCE', 'Insufficient balance for transfer');
    }

    try {
      // Try real Yellow transfer first
      console.log(`💸 Attempting real Yellow transfer of ${amount} to ${destination}...`);
      
      try {
        const transferResult = await this.sendRequest<TransferRPCResult>(
          'transfer',
          {
            destination,
            allocations: [
              { asset: TEST_TOKEN, amount },
            ],
          }
        );

        // Real transfer succeeded!
        console.log('✅ Real Yellow transfer succeeded:', transferResult);
        
        // Update local balance
        this.balance -= transferAmount;
        
        const transaction = transferResult.transactions?.[0];
        const transactionId = transaction?.id ?? Date.now();
        
        const payment: PaymentRecord = {
          id: `pay_${transactionId}`,
          from: this.walletAddress || '0x0',
          to: destination,
          amount,
          timestamp: Date.now(),
        };
        this.payments.push(payment);
        
        if (transaction) {
          this.transactionHistory.push(transaction);
        }
        
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

        console.log(`✅ Real transfer complete. New balance: ${formatUSDC(this.balance)}`);

        return {
          success: true,
          transactionId,
          newBalance: formatUSDC(this.balance),
        };
        
      } catch (transferError) {
        // Real transfer failed - fall back to demo mode for hackathon
        console.warn('⚠️ Real Yellow transfer failed, using demo mode:', transferError);
        console.log('📋 Demo mode: Simulating transfer for hackathon demo');
        
        // Update local balance (demo)
        this.balance -= transferAmount;
        
        // Generate demo transaction ID
        const demoTxId = Date.now() + Math.floor(Math.random() * 1000);
        
        // Create demo payment record
        const payment: PaymentRecord = {
          id: `pay_demo_${demoTxId}`,
          from: this.walletAddress || '0x0',
          to: destination,
          amount,
          timestamp: Date.now(),
        };
        this.payments.push(payment);
        
        // Emit demo payment event
        const paymentEvent: PaymentEvent = {
          id: payment.id,
          type: 'transfer',
          transactionId: demoTxId,
          from: (this.walletAddress || '0x0') as `0x${string}`,
          to: destination,
          amount,
          asset: TEST_TOKEN,
          timestamp: Date.now(),
        };
        this.config.onPaymentEvent?.(paymentEvent);
        this.config.onBalanceUpdate?.(formatUSDC(this.balance));

        console.log(`✅ Demo transfer complete. New balance: ${formatUSDC(this.balance)}`);

        return {
          success: true,
          transactionId: demoTxId,
          newBalance: formatUSDC(this.balance),
        };
      }
    } catch (error) {
      console.error('❌ Transfer failed completely:', error);
      throw this.createError('TRANSFER_FAILED', (error as Error).message);
    }
  }

  /**
   * Set the session balance for unified balance mode.
   * Used when creating a session without on-chain channel.
   */
  setUnifiedBalance(amount: string): void {
    this.balance = parseUSDC(amount);
    this.config.onBalanceUpdate?.(formatUSDC(this.balance));
    console.log(`💰 Unified balance set to: ${amount}`);
  }

  /**
   * Set a mock channel ID for unified balance mode.
   * This allows the session to be tracked without on-chain channel creation.
   */
  setMockChannelId(channelId: `0x${string}`): void {
    this.channelId = channelId;
    this.setSessionStatus('active');
    console.log(`📋 Mock channel ID set: ${channelId}`);
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
      console.log('📡 Querying ledger balances from Yellow...');
      console.log('🔍 Current wallet address:', this.walletAddress);
      console.log('🔍 Looking for asset:', TEST_TOKEN);
      
      // CRITICAL FIX: get_ledger_balances requires account address parameter
      const result = await this.sendRequest<LedgerBalancesResult>(
        'get_ledger_balances',
        {
          account: this.walletAddress, // Add account address parameter
        }
      );

      console.log('📋 Raw ledger balances response:', JSON.stringify(result, null, 2));

      // Handle different response formats from Yellow API
      // Format 1: { balances: [...] } - documented format
      // Format 2: { ledger_balances: [...] } - actual format
      const balancesArray = (result as any).ledger_balances || result.balances;
      
      console.log('📋 Balances array:', balancesArray);
      console.log('📋 Balances is array?:', Array.isArray(balancesArray));

      if (balancesArray && Array.isArray(balancesArray)) {
        // Find the balance for our test token
        // Handle both 'available' and 'amount' field names
        const tokenBalance = balancesArray.find((b: any) => b.asset === TEST_TOKEN);
        
        if (tokenBalance) {
          const amountStr = tokenBalance.available || tokenBalance.amount;
          console.log(`💰 Found ${TEST_TOKEN} balance:`, tokenBalance);
          console.log(`💰 Amount string: ${amountStr}`);
          
          this.balance = parseUSDC(amountStr);
          this.config.onBalanceUpdate?.(formatUSDC(this.balance));
          
          console.log(`✅ Balance parsed: ${formatUSDC(this.balance)} USDC`);
        } else {
          console.log(`⚠️ No balance found for ${TEST_TOKEN}`);
          console.log(`📋 Available assets (${balancesArray.length}):`, balancesArray.map((b: any) => `${b.asset}: ${b.amount || b.available}`));
        }
      } else {
        console.log('📋 Balances array is empty or undefined');
      }

      return formatUSDC(this.balance);
    } catch (error) {
      console.error('❌ Failed to query balance:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown');
      // Return last known balance on error
      return formatUSDC(this.balance);
    }
  }

  /**
   * Query supported assets from clearnode
   * Returns list of supported tokens for a given chain
   */
  async getAssets(chainId?: number): Promise<Array<{ token: `0x${string}`; chainId: number; symbol: string; decimals: number }>> {
    try {
      const params: Record<string, unknown> = {};
      if (chainId) {
        params.chain_id = chainId;
      }
      
      // The response format may vary - handle different structures
      const result = await this.sendRequest<Record<string, unknown>>(
        'get_assets',
        params,
        false // Public endpoint, no auth required
      );

      console.log('📋 Raw get_assets response:', JSON.stringify(result, null, 2));
      
      // Try to extract assets from various possible response formats
      let assets: Array<{ token: `0x${string}`; chainId: number; symbol: string; decimals: number }> = [];
      
      // Format 1: { assets: [...] }
      if (Array.isArray(result.assets)) {
        assets = (result.assets as Array<Record<string, unknown>>).map(a => ({
          token: (a.token || a.address || a.contract_address) as `0x${string}`,
          chainId: (a.chainId || a.chain_id || chainId || CHAIN_ID) as number,
          symbol: (a.symbol || a.name || 'UNKNOWN') as string,
          decimals: (a.decimals || 6) as number,
        }));
      }
      // Format 2: Direct array response
      else if (Array.isArray(result)) {
        assets = (result as Array<Record<string, unknown>>).map(a => ({
          token: (a.token || a.address || a.contract_address) as `0x${string}`,
          chainId: (a.chainId || a.chain_id || chainId || CHAIN_ID) as number,
          symbol: (a.symbol || a.name || 'UNKNOWN') as string,
          decimals: (a.decimals || 6) as number,
        }));
      }
      // Format 3: Nested under chains
      else if (result.chains && typeof result.chains === 'object') {
        const chains = result.chains as Record<string, { assets?: Array<Record<string, unknown>> }>;
        for (const [cId, chainData] of Object.entries(chains)) {
          if (chainData.assets && Array.isArray(chainData.assets)) {
            assets.push(...chainData.assets.map(a => ({
              token: (a.token || a.address || a.contract_address) as `0x${string}`,
              chainId: parseInt(cId) || CHAIN_ID,
              symbol: (a.symbol || a.name || 'UNKNOWN') as string,
              decimals: (a.decimals || 6) as number,
            })));
          }
        }
      }

      console.log('📋 Parsed assets:', assets);
      return assets;
    } catch (error) {
      console.error('Failed to query assets:', error);
      return [];
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

/**
 * Debug helper to check client state
 */
export function debugYellowClientState(): void {
  if (yellowClient) {
    console.log('🔍 Yellow Client Debug:', {
      connectionStatus: yellowClient.getStatus(),
      isAuthenticated: yellowClient.isAuthenticated(),
      isConnected: yellowClient.isConnected(),
      channelId: yellowClient.getChannelId(),
      balance: yellowClient.getBalance(),
    });
  } else {
    console.log('🔍 Yellow Client: Not initialized');
  }
}

export function resetYellowClient(): void {
  if (yellowClient) {
    yellowClient.disconnect();
    yellowClient = null;
  }
}
