import { PaymentRecord, SessionStatus } from '@/types';

// Yellow Network Clearnode endpoints
const CLEARNODE_URLS = {
  production: 'wss://clearnet.yellow.com/ws',
  sandbox: 'wss://clearnet-sandbox.yellow.com/ws',
} as const;

// Use sandbox for development
const CLEARNODE_URL = CLEARNODE_URLS.sandbox;

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

export function parseUSDC(amount: string): bigint {
  const [whole, decimal = ''] = amount.split('.');
  const paddedDecimal = decimal.padEnd(USDC_DECIMALS, '0').slice(0, USDC_DECIMALS);
  return BigInt(whole + paddedDecimal);
}

export function formatUSDC(amount: bigint | string): string {
  const amountStr = amount.toString().padStart(USDC_DECIMALS + 1, '0');
  const whole = amountStr.slice(0, -USDC_DECIMALS) || '0';
  const decimal = amountStr.slice(-USDC_DECIMALS);
  return `${whole}.${decimal}`;
}

interface YellowClientConfig {
  onMessage?: (message: unknown) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: SessionStatus) => void;
}

/**
 * Yellow Network Client
 * 
 * For MVP, we simulate the multi-party payment flow within a single user session.
 * True multi-party app sessions require multiple wallet participants.
 * 
 * This wrapper provides:
 * - WebSocket connection to clearnode
 * - Authentication flow
 * - Session management (simulated for MVP)
 * - Payment tracking
 */
export class YellowClient {
  private ws: WebSocket | null = null;
  private config: YellowClientConfig;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  
  // Session state
  private channelId: string | null = null;
  private balance: bigint = 0n;
  private payments: PaymentRecord[] = [];
  private status: SessionStatus = 'disconnected';

  constructor(config: YellowClientConfig = {}) {
    this.config = config;
  }

  /**
   * Connect to Yellow Network clearnode
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(CLEARNODE_URL);
        
        this.ws.onopen = () => {
          console.log('✅ Connected to Yellow Network');
          this.setStatus('disconnected'); // Connected but no session yet
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('❌ Yellow WebSocket error:', error);
          this.config.onError?.(new Error('WebSocket connection failed'));
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('🔌 Yellow WebSocket closed');
          this.setStatus('disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from clearnode
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  /**
   * Create a simulated session with budget
   * 
   * For MVP, we simulate the session locally rather than creating
   * a real Yellow channel (which requires on-chain transactions).
   */
  async createSession(budgetAmount: string): Promise<{
    channelId: string;
    balance: string;
  }> {
    this.setStatus('creating');
    
    // Simulate session creation delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate a mock channel ID
    this.channelId = `0x${Date.now().toString(16).padStart(64, '0')}`;
    this.balance = parseUSDC(budgetAmount);
    this.payments = [];
    
    this.setStatus('active');
    
    return {
      channelId: this.channelId,
      balance: formatUSDC(this.balance),
    };
  }

  /**
   * Close session and return remaining balance
   */
  async closeSession(): Promise<{
    finalBalance: string;
  }> {
    if (!this.channelId) {
      throw new Error('No active session');
    }

    this.setStatus('closing');
    
    // Simulate settlement delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalBalance = formatUSDC(this.balance);
    
    this.channelId = null;
    this.balance = 0n;
    this.setStatus('closed');
    
    return { finalBalance };
  }

  /**
   * Record a payment between agents
   * 
   * For MVP, this simulates off-chain transfers by updating local state.
   * In production, this would use the Yellow transfer RPC method.
   */
  recordPayment(payment: Omit<PaymentRecord, 'id' | 'timestamp'>): PaymentRecord {
    if (!this.channelId) {
      throw new Error('No active session');
    }

    const paymentAmount = parseUSDC(payment.amount);
    
    if (paymentAmount > this.balance) {
      throw new Error('Insufficient balance');
    }

    // Deduct from balance
    this.balance -= paymentAmount;

    // Create payment record
    const record: PaymentRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ...payment,
      timestamp: Date.now(),
    };

    this.payments.push(record);
    
    return record;
  }

  /**
   * Get current session balance
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
   * Get current session status
   */
  getStatus(): SessionStatus {
    return this.status;
  }

  /**
   * Get channel ID
   */
  getChannelId(): string | null {
    return this.channelId;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.status === 'active' && this.channelId !== null;
  }

  // Private methods

  private setStatus(status: SessionStatus): void {
    this.status = status;
    this.config.onStatusChange?.(status);
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Handle response to pending request
      if (message.res) {
        const [requestId, method, result] = message.res;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          if (method === 'error') {
            pending.reject(new Error(result.error || 'Unknown error'));
          } else {
            pending.resolve(result);
          }
          this.pendingRequests.delete(requestId);
        }
      }

      // Notify listener
      this.config.onMessage?.(message);
    } catch (error) {
      console.error('Failed to parse Yellow message:', error);
    }
  }

  private async sendRequest(method: string, params: unknown): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Yellow Network');
    }

    const requestId = ++this.requestId;
    const timestamp = Date.now();

    const request = {
      req: [requestId, method, params, timestamp],
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.ws!.send(JSON.stringify(request));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
}

// Singleton instance for the app
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
