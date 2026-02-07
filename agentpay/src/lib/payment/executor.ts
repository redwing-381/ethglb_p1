/**
 * Payment Executor
 * 
 * Executes payments to agents and platform without demo fallback.
 * Shows actual success/failure status for all transfers.
 */

import type { YellowClient } from '../yellow/client';
import type { AgentType } from '../ai/agents';

/** Result of a single payment attempt */
export interface PaymentResult {
  success: boolean;
  transactionId?: number;
  error?: string;
  errorCode?: 'INSUFFICIENT_BALANCE' | 'TRANSFER_FAILED' | 'NETWORK_ERROR';
}

/** Individual agent payment request */
export interface AgentPayment {
  address: `0x${string}`;
  amount: string;
  agentType: AgentType;
  agentName: string;
}

/** Platform fee payment request */
export interface PlatformFeePayment {
  address: `0x${string}`;
  amount: string;
}

/** Complete payment execution result */
export interface PaymentExecution {
  payments: Array<PaymentResult & { agentType: AgentType; agentName: string; amount: string }>;
  platformFeeResult: PaymentResult & { amount: string };
  allSuccessful: boolean;
  stoppedEarly: boolean;
  totalPaid: string;
}

/**
 * Determine error code from error message.
 */
function determineErrorCode(error: unknown): PaymentResult['errorCode'] {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('insufficient') || message.includes('balance')) {
    return 'INSUFFICIENT_BALANCE';
  }
  if (message.includes('network') || message.includes('connection')) {
    return 'NETWORK_ERROR';
  }
  return 'TRANSFER_FAILED';
}

/**
 * Execute payments to agents and platform.
 * 
 * Executes transfers sequentially, stopping on first failure.
 * NO DEMO FALLBACK - returns actual success/failure status.
 * 
 * @param yellowClient - Authenticated Yellow client
 * @param agentPayments - Array of agent payments to execute
 * @param platformFee - Platform fee payment
 * @returns Complete payment execution result
 * 
 * @example
 * ```ts
 * const result = await executePayments(client, [
 *   { address: '0x...', amount: '0.02', agentType: 'researcher', agentName: 'Researcher' }
 * ], { address: '0x...', amount: '0.002' });
 * 
 * if (!result.allSuccessful) {
 *   console.error('Payment failed:', result.payments.find(p => !p.success)?.error);
 * }
 * ```
 */
export async function executePayments(
  yellowClient: YellowClient,
  agentPayments: AgentPayment[],
  platformFee: PlatformFeePayment
): Promise<PaymentExecution> {
  const payments: PaymentExecution['payments'] = [];
  let totalPaid = 0;
  let stoppedEarly = false;
  
  // Execute agent payments sequentially
  for (const payment of agentPayments) {
    try {
      console.log(`💸 Executing payment to ${payment.agentName}: ${payment.amount} USDC`);
      const result = await yellowClient.transfer(payment.address, payment.amount);
      
      payments.push({
        success: true,
        transactionId: result.transactionId,
        agentType: payment.agentType,
        agentName: payment.agentName,
        amount: payment.amount,
      });
      
      totalPaid += parseFloat(payment.amount);
      console.log(`✅ Payment to ${payment.agentName} successful. TX: ${result.transactionId}`);
      
    } catch (error) {
      // NO DEMO FALLBACK - report actual failure
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = determineErrorCode(error);
      
      console.error(`❌ Payment to ${payment.agentName} failed:`, errorMsg);
      
      payments.push({
        success: false,
        error: errorMsg,
        errorCode,
        agentType: payment.agentType,
        agentName: payment.agentName,
        amount: payment.amount,
      });
      
      // Stop execution on first failure
      stoppedEarly = true;
      
      return {
        payments,
        platformFeeResult: {
          success: false,
          error: 'Skipped due to previous payment failure',
          amount: platformFee.amount,
        },
        allSuccessful: false,
        stoppedEarly: true,
        totalPaid: totalPaid.toFixed(4),
      };
    }
  }
  
  // Execute platform fee payment
  let platformFeeResult: PaymentExecution['platformFeeResult'];
  
  // Only charge platform fee if there's an amount to charge
  if (parseFloat(platformFee.amount) > 0) {
    try {
      console.log(`💸 Executing platform fee: ${platformFee.amount} USDC`);
      const result = await yellowClient.transfer(platformFee.address, platformFee.amount);
      
      platformFeeResult = {
        success: true,
        transactionId: result.transactionId,
        amount: platformFee.amount,
      };
      
      totalPaid += parseFloat(platformFee.amount);
      console.log(`✅ Platform fee payment successful. TX: ${result.transactionId}`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Platform fee transfer failed';
      console.error(`❌ Platform fee payment failed:`, errorMsg);
      
      platformFeeResult = {
        success: false,
        error: errorMsg,
        errorCode: determineErrorCode(error),
        amount: platformFee.amount,
      };
    }
  } else {
    // No platform fee to charge (e.g., all free agents)
    platformFeeResult = {
      success: true,
      amount: '0',
    };
  }
  
  const allSuccessful = payments.every(p => p.success) && platformFeeResult.success;
  
  return {
    payments,
    platformFeeResult,
    allSuccessful,
    stoppedEarly,
    totalPaid: totalPaid.toFixed(4),
  };
}

/**
 * Validate that the user has sufficient balance for the task.
 * 
 * @param currentBalance - User's current balance
 * @param estimatedCost - Estimated total cost including platform fee
 * @returns True if balance is sufficient
 */
export function validateBalance(currentBalance: number, estimatedCost: string): boolean {
  return currentBalance >= parseFloat(estimatedCost);
}
