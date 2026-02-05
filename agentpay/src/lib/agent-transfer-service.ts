/**
 * Agent Transfer Service
 * 
 * Handles direct transfers between agent wallets.
 * Tracks transaction history and emits events for UI updates.
 */

import type { AgentType, AgentWallet, TransferResult } from './agent-wallet-manager';

export interface Transfer {
  id: string;
  from: string;
  to: string;
  amount: string;
  reason: string;
  timestamp: number;
  transactionId: string | number;
  status: 'pending' | 'completed' | 'failed';
}

export interface TransferRecord {
  id: string;
  timestamp: number;
  from: {
    address: string;
    agentType: AgentType | null;
    displayName: string;
  };
  to: {
    address: string;
    agentType: AgentType | null;
    displayName: string;
  };
  amount: string;
  reason: string;
  transactionId: string | number;
  status: 'pending' | 'completed' | 'failed';
}

export type TransferEventListener = (transfer: Transfer) => void;

/**
 * Agent Transfer Service
 * 
 * Manages direct transfers between agent wallets.
 */
export class AgentTransferService {
  private transferHistory: Map<string, Transfer> = new Map();
  private eventListeners: TransferEventListener[] = [];
  
  /**
   * Transfer from one agent to another
   * 
   * Executes a direct transfer using the sender agent's Yellow client.
   * Updates balances and emits events for UI updates.
   */
  async transferBetweenAgents(
    fromWallet: AgentWallet,
    toWallet: AgentWallet,
    amount: string,
    reason: string
  ): Promise<TransferResult> {
    console.log(`💸 Transfer: ${fromWallet.name} → ${toWallet.name} (${amount} USDC)`);
    console.log(`📝 Reason: ${reason}`);
    
    // Check sender balance before transfer
    const senderBalance = parseFloat(fromWallet.balance);
    const transferAmount = parseFloat(amount);
    
    if (senderBalance < transferAmount) {
      const error = `Insufficient balance: ${fromWallet.name} has ${fromWallet.balance} USDC, needs ${amount} USDC`;
      console.error(`❌ ${error}`);
      
      // Create failed transfer record
      const transfer: Transfer = {
        id: this.generateTransferId(),
        from: fromWallet.address,
        to: toWallet.address,
        amount,
        reason,
        timestamp: Date.now(),
        transactionId: '',
        status: 'failed',
      };
      
      this.transferHistory.set(transfer.id, transfer);
      this.emitTransferEvent(transfer);
      
      return {
        success: false,
        error,
      };
    }
    
    // Create pending transfer record
    const transfer: Transfer = {
      id: this.generateTransferId(),
      from: fromWallet.address,
      to: toWallet.address,
      amount,
      reason,
      timestamp: Date.now(),
      transactionId: '',
      status: 'pending',
    };
    
    this.transferHistory.set(transfer.id, transfer);
    
    try {
      // Execute transfer using sender's wallet
      const result = await fromWallet.transfer(toWallet.address, amount);
      
      if (result.success) {
        // Update transfer record with transaction ID
        transfer.transactionId = result.transactionId || '';
        transfer.status = 'completed';
        this.transferHistory.set(transfer.id, transfer);
        
        console.log(`✅ Transfer complete. TX ID: ${result.transactionId}`);
        console.log(`💰 ${fromWallet.name} new balance: ${result.senderBalance}`);
        
        // Emit event for UI update
        this.emitTransferEvent(transfer);
        
        return result;
      } else {
        // Transfer failed
        transfer.status = 'failed';
        this.transferHistory.set(transfer.id, transfer);
        
        console.error(`❌ Transfer failed: ${result.error}`);
        
        // Emit event for UI update
        this.emitTransferEvent(transfer);
        
        return result;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update transfer record
      transfer.status = 'failed';
      this.transferHistory.set(transfer.id, transfer);
      
      console.error(`❌ Transfer error: ${errorMessage}`);
      
      // Emit event for UI update
      this.emitTransferEvent(transfer);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
  
  /**
   * Get transfer history for a specific agent
   */
  getTransferHistory(agentAddress: string): Transfer[] {
    const transfers: Transfer[] = [];
    
    for (const transfer of this.transferHistory.values()) {
      if (transfer.from === agentAddress || transfer.to === agentAddress) {
        transfers.push(transfer);
      }
    }
    
    // Sort by timestamp (newest first)
    return transfers.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Get all transfer history
   */
  getAllTransfers(): Transfer[] {
    return Array.from(this.transferHistory.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Get transfer by ID
   */
  getTransfer(transferId: string): Transfer | undefined {
    return this.transferHistory.get(transferId);
  }
  
  /**
   * Register event listener for transfer events
   */
  onTransfer(listener: TransferEventListener): () => void {
    this.eventListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Emit transfer event to all listeners
   */
  emitTransferEvent(transfer: Transfer): void {
    console.log(`📢 Emitting transfer event: ${transfer.id}`);
    
    for (const listener of this.eventListeners) {
      try {
        listener(transfer);
      } catch (error) {
        console.error('Error in transfer event listener:', error);
      }
    }
  }
  
  /**
   * Generate unique transfer ID
   */
  private generateTransferId(): string {
    return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get transfer statistics
   */
  getTransferStats(): {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    totalAmount: string;
  } {
    let completed = 0;
    let failed = 0;
    let pending = 0;
    let totalAmount = 0;
    
    for (const transfer of this.transferHistory.values()) {
      if (transfer.status === 'completed') {
        completed++;
        totalAmount += parseFloat(transfer.amount);
      } else if (transfer.status === 'failed') {
        failed++;
      } else if (transfer.status === 'pending') {
        pending++;
      }
    }
    
    return {
      total: this.transferHistory.size,
      completed,
      failed,
      pending,
      totalAmount: totalAmount.toFixed(6),
    };
  }
  
  /**
   * Clear transfer history
   */
  clearHistory(): void {
    this.transferHistory.clear();
    console.log('🗑️ Transfer history cleared');
  }
}

// Singleton instance
let serviceInstance: AgentTransferService | null = null;

/**
 * Get or create the singleton agent transfer service instance
 */
export function getAgentTransferService(): AgentTransferService {
  if (!serviceInstance) {
    serviceInstance = new AgentTransferService();
  }
  return serviceInstance;
}

/**
 * Transfer between agents (convenience function)
 */
export async function transferBetweenAgents(
  fromWallet: AgentWallet,
  toWallet: AgentWallet,
  amount: string,
  reason: string
): Promise<TransferResult> {
  const service = getAgentTransferService();
  return service.transferBetweenAgents(fromWallet, toWallet, amount, reason);
}

/**
 * Register transfer event listener (convenience function)
 */
export function onTransferEvent(listener: TransferEventListener): () => void {
  const service = getAgentTransferService();
  return service.onTransfer(listener);
}
