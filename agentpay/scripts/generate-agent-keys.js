#!/usr/bin/env node

/**
 * Generate Agent Private Keys
 * 
 * This script generates three private keys for agent wallets.
 * Run this once to set up your agent-owned wallets feature.
 * 
 * Usage:
 *   node scripts/generate-agent-keys.js
 * 
 * The script will output environment variables that you can copy
 * to your .env.local file.
 */

const crypto = require('crypto');

function generatePrivateKey() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

function deriveAddress(privateKey) {
  // This is a simplified version - in production, use ethers or viem
  // For now, just show the key
  return 'Run with ethers to see address';
}

console.log('🔐 Generating Agent Private Keys...\n');
console.log('⚠️  IMPORTANT: Never commit these keys to version control!\n');
console.log('Copy these lines to your agentpay/.env.local file:\n');
console.log('# ============================================================================');
console.log('# Agent-Owned Wallets (Server-Side Only)');
console.log('# ============================================================================\n');

const orchestratorKey = generatePrivateKey();
const researcherKey = generatePrivateKey();
const writerKey = generatePrivateKey();

console.log(`ORCHESTRATOR_PRIVATE_KEY=${orchestratorKey}`);
console.log(`RESEARCHER_PRIVATE_KEY=${researcherKey}`);
console.log(`WRITER_PRIVATE_KEY=${writerKey}`);
console.log();
console.log('# Enable agent-owned wallets feature');
console.log('ENABLE_AGENT_WALLETS=true');
console.log();
console.log('✅ Keys generated successfully!');
console.log();
console.log('Next steps:');
console.log('1. Copy the above lines to agentpay/.env.local');
console.log('2. Restart your development server');
console.log('3. The agents will initialize automatically on first use');
console.log('4. Request test tokens from Yellow faucet for each agent');
