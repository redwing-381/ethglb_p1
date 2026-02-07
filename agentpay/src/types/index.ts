// Session Types
export interface YellowSession {
  channelId: string;
  balance: string;
  status: SessionStatus;
  createdAt: number;
}

export type SessionStatus = 
  | 'disconnected' 
  | 'creating' 
  | 'active' 
  | 'closing' 
  | 'closed' 
  | 'error';

export interface SessionState {
  channelId: string | null;
  balance: string;
  status: SessionStatus;
  payments: PaymentRecord[];
  createdAt: number | null;
}

// Payment Types
export interface PaymentRecord {
  id: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
}

// ============================================================================
// Debate Agent Types
// ============================================================================

export type DebateAgentType = 
  | 'moderator' 
  | 'debater_a' 
  | 'debater_b' 
  | 'fact_checker' 
  | 'judge' 
  | 'summarizer';

export interface DebateContribution {
  role: DebateAgentType;
  agentName: string;
  content: string;
  round: number;        // 0 for intro/verdict/summary, 1-3 for rounds
  timestamp: number;
  score?: RoundScore;
  factCheckResult?: FactCheckResult;
}

export interface RoundScore {
  proScore: number;     // 1-10
  conScore: number;     // 1-10
  reasoning: string;
  needsMoreRounds: boolean;
}

export interface FactCheckResult {
  claims: ClaimVerification[];
  overallAssessment: string;
}

export interface ClaimVerification {
  claim: string;
  source: 'debater_a' | 'debater_b';
  verdict: 'accurate' | 'misleading' | 'false' | 'unverifiable';
  explanation: string;
}

export interface DebateState {
  topic: string;
  currentRound: number;
  maxRounds: number;
  contributions: DebateContribution[];
  scores: RoundScore[];
  isComplete: boolean;
}

export interface DebateTranscript {
  topic: string;
  rounds: DebateRound[];
  verdict: string;
  summary: string;
  winner: 'pro' | 'con' | 'tie';
  totalRounds: number;
}

export interface DebateRound {
  number: number;
  proArgument: string;
  conArgument: string;
  factCheck: FactCheckResult;
  score: RoundScore;
}

export interface DebateCostBreakdown {
  agentCosts: Array<{
    agentType: DebateAgentType | 'judge_verdict';
    agentName: string;
    amount: string;
    label: string;
  }>;
  platformFee: string;
  platformFeePercentage: number;
  totalAgentCost: string;
  totalCost: string;
  roundCount: number;
}

export interface JudgeResult {
  content: string;
  score: RoundScore;
  success: boolean;
  error?: string;
}

export interface DebateStepEvent {
  step: 'moderator_intro' | 'debater_a' | 'debater_b' | 'fact_check' | 'judge_score' | 'judge_verdict' | 'summary';
  round: number;
  agentName: string;
  status: 'started' | 'completed';
}


// Agent Config
export interface AgentResult {
  content: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// Activity Event Types
// ============================================================================

export type ActivityEvent = 
  | { id: string; type: 'payment'; timestamp: number; data: PaymentEventData }
  | { id: string; type: 'platform_fee'; timestamp: number; data: PlatformFeeEventData }
  | { id: string; type: 'task_start'; timestamp: number; data: TaskStartData }
  | { id: string; type: 'subtask_start'; timestamp: number; data: SubTaskStartData }
  | { id: string; type: 'subtask_complete'; timestamp: number; data: SubTaskCompleteData }
  | { id: string; type: 'task_complete'; timestamp: number; data: TaskCompleteData }
  | { id: string; type: 'settlement'; timestamp: number; data: SettlementData }
  | { id: string; type: 'error'; timestamp: number; data: ErrorData }
  | { id: string; type: 'balance_sync'; timestamp: number; data: BalanceSyncData }
  | { id: string; type: 'round_marker'; timestamp: number; data: RoundMarkerData };

export interface PaymentEventData {
  from: string;
  to: string;
  amount: string;
  asset: string;
  transactionId?: number;
  success?: boolean;
  error?: string;
}

export interface PlatformFeeEventData {
  from: string;
  to: string;
  amount: string;
  asset: string;
  feePercentage: number;
  transactionId?: number;
  success?: boolean;
  error?: string;
}

export interface BalanceSyncData {
  balance: string;
  isStale: boolean;
}

export interface TaskStartData {
  taskId: string;
  description: string;
}

export interface SubTaskStartData {
  subTaskId: string;
  agentName: string;
  description: string;
}

export interface SubTaskCompleteData {
  subTaskId: string;
  agentName: string;
  success: boolean;
}

export interface TaskCompleteData {
  taskId: string;
  totalCost: string;
  agentsUsed: string[];
}

export interface SettlementData {
  channelId: string;
  txHash: string;
  finalBalance: string;
  totalSpent: string;
  etherscanUrl: string;
}

export interface RoundMarkerData {
  round: number;
  totalRounds: number;
}

export interface ErrorData {
  message: string;
  code?: string;
}

// API Types
export interface CreateSessionRequest {
  walletAddress: string;
  budgetAmount: string;
  chainId: number;
}

export interface CreateSessionResponse {
  channelId: string;
  balance: string;
  status: 'active';
}

export interface CloseSessionRequest {
  channelId: string;
  walletAddress: string;
}

export interface CloseSessionResponse {
  finalBalance: string;
  status: 'closed';
}

// Error Types
export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export type ErrorCode = 
  | 'WALLET_CONNECTION_FAILED'
  | 'SESSION_CREATION_FAILED'
  | 'INSUFFICIENT_BALANCE'
  | 'AGENT_EXECUTION_FAILED'
  | 'TASK_PROCESSING_FAILED'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR';

// ============================================================================
// ENS Agent Registry Types
// ============================================================================

export interface EnsAgentConfig {
  agentType: DebateAgentType | 'platform';
  ensName: string;
  address: `0x${string}`;
  name: string;
  description: string;
  model: string;
  basePrice: string;
  icon: string;
  avatar: string | null;
  isEnsResolved: boolean;
}

export interface EnsTextRecords {
  description: string | null;
  role: string | null;
  model: string | null;
  price: string | null;
  avatar: string | null;
}

// ============================================================================
// Agent Forum Types
// ============================================================================

export interface ForumPost {
  id: string;
  agentType: DebateAgentType | 'platform';
  content: string;
  timestamp: number;
  isAiGenerated: boolean;
  payment?: ForumPayment;
}

export interface ForumPayment {
  fromAgent: DebateAgentType | 'platform';
  toAgent: DebateAgentType | 'platform';
  amount: string;
  reason: string;
}

export interface ForumConfig {
  minInterval: number;
  maxInterval: number;
  maxPosts: number;
  aiPercentage: number;
  paymentPercentage: number;
}
