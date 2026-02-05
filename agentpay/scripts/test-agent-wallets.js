#!/usr/bin/env node

/**
 * Test Agent Wallets
 * 
 * This script tests the agent wallet initialization.
 * Run this to verify your agent wallets are set up correctly.
 */

const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Agent Wallet Setup...\n');

// Read .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse environment variables
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const keys = {
  orchestrator: env.ORCHESTRATOR_PRIVATE_KEY,
  researcher: env.RESEARCHER_PRIVATE_KEY,
  writer: env.WRITER_PRIVATE_KEY,
};

const enabled = env.ENABLE_AGENT_WALLETS === 'true';

console.log(`Feature Flag: ENABLE_AGENT_WALLETS = ${enabled ? '✅ true' : '❌ false'}\n`);

if (!enabled) {
  console.log('⚠️  Agent wallets are disabled. Set ENABLE_AGENT_WALLETS=true to enable.\n');
  process.exit(0);
}

let allValid = true;

for (const [name, key] of Object.entries(keys)) {
  if (!key) {
    console.log(`❌ ${name.toUpperCase()}_PRIVATE_KEY is not set`);
    allValid = false;
    continue;
  }

  if (!key.startsWith('0x') || key.length !== 66) {
    console.log(`❌ ${name.toUpperCase()}_PRIVATE_KEY is invalid (must be 66 chars starting with 0x)`);
    allValid = false;
    continue;
  }

  try {
    const account = privateKeyToAccount(key);
    console.log(`✅ ${name.charAt(0).toUpperCase() + name.slice(1)} Agent:`);
    console.log(`   Address: ${account.address}`);
    console.log(`   Key: ${key.slice(0, 10)}...${key.slice(-8)}\n`);
  } catch (error) {
    console.log(`❌ ${name.toUpperCase()}_PRIVATE_KEY is invalid: ${error.message}`);
    allValid = false;
  }
}

if (allValid) {
  console.log('✅ All agent wallets are configured correctly!\n');
  console.log('Next steps:');
  console.log('1. Restart your dev server to pick up new env vars');
  console.log('2. Request test tokens from Yellow faucet for each agent address:');
  console.log('   https://clearnet-sandbox.yellow.com/faucet/requestTokens');
  console.log('3. Submit a task to test agent-to-agent transfers\n');
} else {
  console.log('❌ Some agent wallets are not configured correctly.');
  console.log('Run: node scripts/generate-agent-keys.js\n');
  process.exit(1);
}
