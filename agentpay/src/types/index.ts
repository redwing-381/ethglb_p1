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

// Task Types
export interface TaskState {
  id: string;
  description: string;
  status: TaskStatus;
  subTasks: SubTaskState[];
  result: string | null;
  totalCost: string;
  startedAt: number;
  completedAt: number | null;
}

export type TaskStatus = 
  | 'pending' 
  | 'planning' 
  | 'executing' 
  | 'complete' 
  | 'failed';

export interface SubTaskState {
  id: string;
  description: string;
  agentType: AgentType;
  status: 'pending' | 'executing' | 'complete' | 'failed';
  result: string | null;
  cost: string;
}

// Agent Types
export type AgentType = 'orchestrator' | 'researcher' | 'writer';

export interface AgentConfig {
  name: string;
  type: AgentType;
  costPerTask: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
}

export interface AgentResult {
  content: string;
  success: boolean;
  error?: string;
}

export interface OrchestratorPlan {
  subTasks: SubTask[];
  estimatedCost: string;
}

export interface SubTask {
  id: string;
  description: string;
  agentType: AgentType;
  order: number;
}

// Activity Event Types
export type ActivityEvent = 
  | { id: string; type: 'payment'; timestamp: number; data: PaymentEventData }
  | { id: string; type: 'task_start'; timestamp: number; data: TaskStartData }
  | { id: string; type: 'subtask_start'; timestamp: number; data: SubTaskStartData }
  | { id: string; type: 'subtask_complete'; timestamp: number; data: SubTaskCompleteData }
  | { id: string; type: 'task_complete'; timestamp: number; data: TaskCompleteData }
  | { id: string; type: 'error'; timestamp: number; data: ErrorData };

export interface PaymentEventData {
  from: string;
  to: string;
  amount: string;
  asset: string;
  transactionId?: number;
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

export interface TaskRequest {
  task: string;
  channelId: string;
}

export interface TaskResponse {
  status: 'processing' | 'complete' | 'error';
  events: ActivityEvent[];
  result?: TaskResult;
  error?: string;
}

export interface TaskResult {
  content: string;
  totalCost: string;
  agentsUsed: string[];
  subTaskCount: number;
}

export interface AgentExecuteRequest {
  agentType: 'researcher' | 'writer';
  subTask: string;
  context?: string;
}

export interface AgentExecuteResponse {
  result: string;
  tokensUsed: number;
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
