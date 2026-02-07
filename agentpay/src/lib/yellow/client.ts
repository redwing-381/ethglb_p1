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
} from './config';
import { SessionKeyManager, type SessionKeyPair } from './session-keys';

// Re-export config for convenience
export { TOKEN_DECIMALS as USDC_DECIMALS } from './config';

// ============================================================================
// ERC-20 Token Utilities
// ============================================================================

export const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

export const TOKEN_CONTRACT = TEST_TOKEN_ADDRESS;
export const CUSTODY_CONTRACT = CUSTODY_ADDRESS;

export function toTokenUnits(usdcAmount: string): bigint {
  const amount = parseFloat(usdcAmount);
  return BigInt(Math.floor(amount * Math.pow(10, TOKEN_DECIMALS)));
}

export function fromTokenUnits(tokenUnits: bigint): string {
  const amount = Number(tokenUnits) / Math.pow(10, TOKEN_DECIMALS);
  return amount.toFixed(2);
}

export const ERROR_MESSAGES = {
  INSUFFICIENT_BALANCE: (have: string, need: string) => 
    `Insufficient balance. You have ${have} USDC but need ${need} USDC. Use the faucet to get test tokens.`,
  ZERO_BALANCE: () =>
    `You have 0 USDC. Click the faucet button to get test tokens.`,
  APPROVAL_REJECTED: () =>
    `Approval cancelled. Click "Create Session" to try again.`,
  APPROVAL_FAILED: (reason: string) =>
    `Approval failed: ${reason}. Please try again.`,
  ALLOWANCE_CHECK_FAILED: () =>
    `Unable to check approval status. You may need to approve tokens manually.`,
  CHANNEL_CREATION_FAILED: (reason: string) =>
    `Channel creation failed: ${reason}. Your approval is still valid.`,
} as const;

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
  domain: { name: string };
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
  currentChainId?: number;
  switchChain?: (chainId: number) => Promise<void>;
  signState: (packedState: `0x${string}`) => Promise<`0x${string}`>;
  writeContract: (params: WriteContractParams) => Promise<`0x${string}`>;
  waitForTransaction: (hash: `0x${string}`) => Promise<void>;
  readContract?: <T>(params: ReadContractParams) => Promise<T>;
}

export interface ReadContractParams {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: unknown[];
}

export interface CheckBalanceParams {
  userAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  readContract: <T>(params: ReadContractParams) => Promise<T>;
}

export interface CheckBalanceResult {
  balance: bigint;
  hasEnoughBalance: boolean;
}

export interface CheckAllowanceParams {
  userAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  spenderAddress: `0x${string}`;
  readContract: <T>(params: ReadContractParams) => Promise<T>;
}

export interface CheckAllowanceResult {
  allowance: bigint;
  hasEnoughAllowance: boolean;
  needsApproval: boolean;
}

export interface ApproveTokensParams {
  tokenAddress: `0x${string}`;
  spenderAddress: `0x${string}`;
  amount: bigint;
  writeContract: (params: WriteContractParams) => Promise<`0x${string}`>;
  waitForTransaction: (hash: `0x${string}`) => Promise<void>;
}

export interface ApproveTokensResult {
  hash: `0x${string}`;
  success: boolean;
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
  gas?: bigint;
}

export interface ChannelInfo {
  channelId: `0x${string}`;
  balance: string;
  status: SessionStatus;
  txHash?: `0x${string}`;
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
  intent: number;
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

interface TransactionRecord {
  id: number;
  tx_type: string;
  from_account: `0x${string}`;
  to_account: `0x${string}`;
  asset: string;
  amount: string;
  created_at: string;
}

// Custody Contract ABI
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

interface RPCRequest {
  req: [number, string, Record<string, unknown>, number];
  sig?: string[];
}

interface RPCResponse {
  res?: [number, string, Record<string, unknown>, number];
  err?: { code: number; message: string };
  sig?: string[];
}

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
  const trimmedDecimal = decimal.replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${trimmedDecimal}`;
}


// ============================================================================
// Yellow Client Class
// ============================================================================

export class YellowClient {
  private config: Required<Pick<YellowClientConfig, 
    'clearnodeUrl' | 'chainId' | 'custodyAddress' | 'adjudicatorAddress' | 'applicationName'
  >> & YellowClientConfig;
  
  private ws: WebSocket | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    retried: boolean;
  }>();
  
  private sessionKeyManager = new SessionKeyManager();
  private jwtToken: string | null = null;
  private walletAddress: `0x${string}` | null = null;
  
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

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
    
    this.setConnectionStatus('disconnected');
  }

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
        if (this.jwtToken && this.walletAddress && this.sessionKeyManager.hasValidSessionKey()) {
          console.log('🔐 Restoring authenticated status after reconnection...');
          this.setConnectionStatus('authenticated');
        }
      } catch {
        this.attemptReconnect();
      }
    }, delay);
  }

  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  isConnected(): boolean {
    return this.connectionStatus === 'connected' || this.connectionStatus === 'authenticated';
  }

  isAuthenticated(): boolean {
    return this.connectionStatus === 'authenticated' && this.jwtToken !== null;
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as RPCResponse;
      
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

  private async sendRequest<T>(
    method: string, 
    params: Record<string, unknown>,
    requiresAuth = true
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Yellow Network');
    }

    const requestId = ++this.requestId;
    const timestamp = Date.now();

    const request: RPCRequest = {
      req: [requestId, method, params, timestamp],
    };

    if (requiresAuth && this.sessionKeyManager.hasValidSessionKey()) {
      const signature = await this.sessionKeyManager.signRequest(request);
      request.sig = [signature];
    }

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

  private async sendSignedRequest<T>(
    method: string, 
    params: Record<string, unknown>,
    signatures: `0x${string}`[]
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Yellow Network');
    }

    const requestId = ++this.requestId;
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

  async authenticate(params: AuthParams): Promise<AuthResult> {
    this.setConnectionStatus('authenticating');
    this.walletAddress = params.walletAddress;
    
    const sessionKey = this.sessionKeyManager.generateSessionKey();
    
    const expiresAtMs = params.expiresAt ?? Date.now() + SESSION_EXPIRY;
    const expiresAtSec = Math.floor(expiresAtMs / 1000);
    const allowances = params.allowances ?? [{ asset: TEST_TOKEN, amount: '1000000000' }];
    const scope = params.scope ?? DEFAULT_SCOPE;

    try {
      const authChallenge = await this.sendRequest<{ challenge_message: string }>(
        'auth_request',
        {
          address: params.walletAddress,
          session_key: sessionKey.publicKey,
          application: this.config.applicationName,
          allowances,
          scope,
          expires_at: expiresAtSec,
        },
        false
      );

      const typedData = this.buildEIP712TypedData(
        authChallenge.challenge_message,
        scope,
        params.walletAddress,
        sessionKey.publicKey,
        expiresAtSec,
        allowances
      );

      const signature = await params.signTypedData(typedData);

      const authResult = await this.sendSignedRequest<{ jwt_token: string; success: boolean }>(
        'auth_verify',
        { challenge: authChallenge.challenge_message },
        [signature]
      );

      if (!authResult.success) {
        throw new Error('Authentication failed');
      }

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

  private buildEIP712TypedData(
    challenge: string,
    scope: string,
    wallet: `0x${string}`,
    sessionKey: `0x${string}`,
    expiresAtSeconds: number,
    allowances: Allowance[]
  ): SignTypedDataParams {
    return {
      domain: { name: this.config.applicationName },
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
        expires_at: expiresAtSeconds,
        allowances,
      },
    };
  }


  async createChannel(params: CreateChannelParams): Promise<ChannelInfo> {
    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must authenticate before creating channel');
    }

    this.setSessionStatus('creating');
    
    try {
      const chainId = params.chainId ?? this.config.chainId;
      
      let token = params.token;
      if (!token) {
        const assets = await this.getAssets(chainId);
        const usdToken = assets.find(a => 
          a.symbol?.toLowerCase().includes('usd') || 
          a.symbol?.toLowerCase().includes('usdc')
        );
        
        if (usdToken?.token && usdToken.token !== '0x0000000000000000000000000000000000000000') {
          token = usdToken.token;
        } else if (assets.length > 0 && assets[0].token && assets[0].token !== '0x0000000000000000000000000000000000000000') {
          token = assets[0].token;
        } else {
          token = TEST_TOKEN_ADDRESS;
        }
      }
      
      if (!token || token === '0x0000000000000000000000000000000000000000') {
        throw new Error('Invalid token address. Cannot create channel with zero address.');
      }
      
      const createResult = await this.sendRequest<CreateChannelRPCResult>(
        'create_channel',
        { chain_id: chainId, token }
      );

      if (!createResult.server_signature) {
        throw new Error('Missing server signature in create_channel response');
      }

      const packedState = this.packState(createResult.channel_id, createResult.state);
      const stateHash = keccak256(packedState);

      const userSignature = await params.signState(stateHash);

      const requiredChainId = chainId;
      if (params.currentChainId && params.currentChainId !== requiredChainId) {
        if (params.switchChain) {
          await params.switchChain(requiredChainId);
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          throw new Error(
            `Wrong network: Please switch to Sepolia (chain ID ${requiredChainId}).`
          );
        }
      }
      
      const depositAmount = parseUSDC(params.amount);
      
      const channelForContract = {
        participants: createResult.channel.participants,
        adjudicator: createResult.channel.adjudicator,
        challenge: BigInt(createResult.channel.challenge),
        nonce: BigInt(createResult.channel.nonce),
      };
      
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
      
      const normalizedCustodyAddress = getAddress(this.config.custodyAddress);
      
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
        gas: 500000n,
      });

      console.log(`📝 Transaction submitted: ${txHash}`);
      console.log(`🔗 Etherscan: https://sepolia.etherscan.io/tx/${txHash}`);
      
      await params.waitForTransaction(txHash);

      this.channelId = createResult.channel_id;
      this.balance = depositAmount;
      this.payments = [];
      
      this.setSessionStatus('active');
      this.persistState();

      return {
        channelId: this.channelId,
        balance: formatUSDC(this.balance),
        status: 'active',
        txHash: txHash as `0x${string}`,
      };
    } catch (error) {
      console.error('❌ Channel creation failed:', error);
      this.setSessionStatus('error');
      throw this.createError('CHANNEL_CREATION_FAILED', (error as Error).message);
    }
  }

  private computeChannelId(
    participants: [`0x${string}`, `0x${string}`],
    adjudicator: `0x${string}`,
    challenge: bigint,
    nonce: bigint,
    chainId: bigint
  ): `0x${string}` {
    const encoded = encodeAbiParameters(
      [
        { name: 'participants', type: 'address[]' },
        { name: 'adjudicator', type: 'address' },
        { name: 'challenge', type: 'uint64' },
        { name: 'nonce', type: 'uint64' },
        { name: 'chainId', type: 'uint256' },
      ],
      [
        participants.map(p => getAddress(p)),
        getAddress(adjudicator),
        challenge,
        nonce,
        chainId,
      ]
    );
    return keccak256(encoded);
  }

  private packState(channelId: `0x${string}`, state: ChannelStateRPC): `0x${string}` {
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

  async closeChannel(params: CloseChannelParams): Promise<CloseResult> {
    if (!this.channelId) {
      throw this.createError('CHANNEL_NOT_FOUND', 'No active channel');
    }

    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must be authenticated to close channel');
    }

    this.setSessionStatus('closing');
    
    try {
      const closeResult = await this.sendRequest<CloseChannelRPCResult>(
        'close_channel',
        {
          channel_id: this.channelId,
          funds_destination: params.fundsDestination,
        }
      );

      if (!closeResult.server_signature) {
        throw new Error('Missing server signature in close_channel response');
      }

      const packedState = this.packState(closeResult.channel_id, closeResult.state);
      const stateHash = keccak256(packedState);

      const userSignature = await params.signState(stateHash);

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

      await params.waitForTransaction(txHash);

      const finalBalance = formatUSDC(this.balance);
      
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

  async transfer(destination: `0x${string}`, amount: string): Promise<TransferResult> {
    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must be authenticated to transfer');
    }

    const transferAmount = parseUSDC(amount);
    
    if (transferAmount > this.balance) {
      throw this.createError('INSUFFICIENT_BALANCE', 'Insufficient balance for transfer');
    }

    try {
      const transferResult = await this.sendRequest<TransferRPCResult>(
        'transfer',
        {
          destination,
          allocations: [{ asset: TEST_TOKEN, amount }],
        }
      );

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

  setUnifiedBalance(amount: string): void {
    this.balance = parseUSDC(amount);
    this.config.onBalanceUpdate?.(formatUSDC(this.balance));
  }

  setMockChannelId(channelId: `0x${string}`): void {
    this.channelId = channelId;
    this.setSessionStatus('active');
  }


  async queryBalance(): Promise<string> {
    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must be authenticated to query balance');
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.sendRequest<any>(
        'get_ledger_balances',
        { account: this.walletAddress }
      );

      const balancesArray = result.ledger_balances || result.balances;

      if (balancesArray && Array.isArray(balancesArray)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tokenBalance = balancesArray.find((b: any) => b.asset === TEST_TOKEN);
        
        if (tokenBalance) {
          const amountStr = tokenBalance.available || tokenBalance.amount;
          this.balance = parseUSDC(amountStr);
          this.config.onBalanceUpdate?.(formatUSDC(this.balance));
        }
      }

      return formatUSDC(this.balance);
    } catch (error) {
      console.error('❌ Failed to query balance:', error);
      return formatUSDC(this.balance);
    }
  }

  async getAssets(chainId?: number): Promise<Array<{ token: `0x${string}`; chainId: number; symbol: string; decimals: number }>> {
    try {
      const params: Record<string, unknown> = {};
      if (chainId) {
        params.chain_id = chainId;
      }
      
      const result = await this.sendRequest<Record<string, unknown>>(
        'get_assets',
        params,
        false
      );
      
      let assets: Array<{ token: `0x${string}`; chainId: number; symbol: string; decimals: number }> = [];
      
      if (Array.isArray(result.assets)) {
        assets = (result.assets as Array<Record<string, unknown>>).map(a => ({
          token: (a.token || a.address || a.contract_address) as `0x${string}`,
          chainId: (a.chainId || a.chain_id || chainId || CHAIN_ID) as number,
          symbol: (a.symbol || a.name || 'UNKNOWN') as string,
          decimals: (a.decimals || 6) as number,
        }));
      } else if (Array.isArray(result)) {
        assets = (result as Array<Record<string, unknown>>).map(a => ({
          token: (a.token || a.address || a.contract_address) as `0x${string}`,
          chainId: (a.chainId || a.chain_id || chainId || CHAIN_ID) as number,
          symbol: (a.symbol || a.name || 'UNKNOWN') as string,
          decimals: (a.decimals || 6) as number,
        }));
      } else if (result.chains && typeof result.chains === 'object') {
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

      return assets;
    } catch (error) {
      console.error('Failed to query assets:', error);
      return [];
    }
  }

  async getChannels(): Promise<Array<{ channel_id: string; status: string; amount?: string }>> {
    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must be authenticated to get channels');
    }

    try {
      const result = await this.sendRequest<{ channels: Array<{ channel_id: string; status: string; amount?: string }> }>(
        'get_channels',
        { account: this.walletAddress }
      );
      
      return result.channels || [];
    } catch (error) {
      console.error('❌ Failed to get channels:', error);
      return [];
    }
  }

  setActiveChannel(channelId: `0x${string}`, balance?: string): void {
    this.channelId = channelId;
    if (balance) {
      this.balance = parseUSDC(balance);
    }
    this.setSessionStatus('active');
  }

  async resizeChannel(params: {
    channelId: `0x${string}`;
    allocateAmount: bigint;
    fundsDestination?: `0x${string}`;
  }): Promise<{ success: boolean; channelId: string }> {
    if (!this.isAuthenticated()) {
      throw this.createError('AUTH_FAILED', 'Must be authenticated to resize channel');
    }

    try {
      const result = await this.sendRequest<{ channel_id: string }>(
        'resize_channel',
        {
          channel_id: params.channelId,
          allocate_amount: params.allocateAmount.toString(),
          funds_destination: params.fundsDestination || this.walletAddress,
        }
      );
      
      this.channelId = params.channelId;
      this.balance = params.allocateAmount;
      this.config.onBalanceUpdate?.(formatUSDC(this.balance));
      
      return {
        success: true,
        channelId: result.channel_id,
      };
    } catch (error) {
      console.error('❌ Failed to resize channel:', error);
      throw this.createError('CHANNEL_CREATION_FAILED', `Failed to resize channel: ${(error as Error).message}`);
    }
  }

  getBalance(): string {
    return formatUSDC(this.balance);
  }

  getPaymentHistory(): PaymentRecord[] {
    return [...this.payments];
  }

  getTransactionHistory(): TransactionRecord[] {
    return [...this.transactionHistory];
  }

  getChannelId(): `0x${string}` | null {
    return this.channelId;
  }

  getSessionStatus(): SessionStatus {
    return this.sessionStatus;
  }

  isActive(): boolean {
    return this.sessionStatus === 'active' && this.channelId !== null;
  }

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

  restoreState(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      
      const state: PersistedYellowState = JSON.parse(stored);
      
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

  clearPersistedState(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }

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
// Token Approval Functions
// ============================================================================

export async function checkTokenBalance(
  params: CheckBalanceParams,
  depositAmount: bigint
): Promise<CheckBalanceResult> {
  try {
    const balance = await params.readContract<bigint>({
      address: params.tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [params.userAddress],
    });

    return {
      balance,
      hasEnoughBalance: balance >= depositAmount,
    };
  } catch (error) {
    throw new Error(`Failed to check token balance: ${(error as Error).message}`);
  }
}

export async function checkTokenAllowance(
  params: CheckAllowanceParams,
  depositAmount: bigint
): Promise<CheckAllowanceResult> {
  try {
    const allowance = await params.readContract<bigint>({
      address: params.tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [params.userAddress, params.spenderAddress],
    });

    const hasEnoughAllowance = allowance >= depositAmount;

    return {
      allowance,
      hasEnoughAllowance,
      needsApproval: !hasEnoughAllowance,
    };
  } catch (error) {
    throw new Error(`Failed to check token allowance: ${(error as Error).message}`);
  }
}

export async function approveTokens(
  params: ApproveTokensParams
): Promise<ApproveTokensResult> {
  try {
    const hash = await params.writeContract({
      address: params.tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [params.spenderAddress, params.amount],
    });

    await params.waitForTransaction(hash);

    return {
      hash,
      success: true,
    };
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).code === 'ACTION_REJECTED' || (error as Error).message.includes('rejected')) {
      throw new Error('Approval cancelled by user');
    }
    
    throw new Error(`Token approval failed: ${(error as Error).message}`);
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
