# Agent-Owned Wallets

This document explains how to set up and use the agent-owned wallets feature in AgentPay.

## Overview

Agent-owned wallets enable each AI agent (Orchestrator, Researcher, Writer) to have its own:
- Private key and Ethereum address
- Yellow Network session and unified balance
- Ability to receive payments and make transfers independently

This demonstrates true agent autonomy and better showcases Yellow Network's capabilities.

## Architecture

```
User Wallet
    ↓ (funds agents at session start)
Platform Wallet Manager (Server-Side)
    ├── Orchestrator Wallet
    ├── Researcher Wallet
    └── Writer Wallet
         ↓ (direct agent-to-agent transfers)
    Yellow Network
```

## Setup

### 1. Generate Agent Private Keys

Run the key generation script:

```bash
cd agentpay
node scripts/generate-agent-keys.js
```

This will output three private keys. Copy them to your `.env.local` file.

### 2. Update Environment Variables

Add these lines to `agentpay/.env.local`:

```bash
# Agent-Owned Wallets (Server-Side Only)
ORCHESTRATOR_PRIVATE_KEY=0x...
RESEARCHER_PRIVATE_KEY=0x...
WRITER_PRIVATE_KEY=0x...

# Enable agent-owned wallets feature
ENABLE_AGENT_WALLETS=true
```

### 3. Request Test Tokens

Each agent needs test tokens from Yellow's faucet:

1. Start your development server: `bun dev`
2. The agent addresses will be logged on first initialization
3. Request tokens for each agent at: https://clearnet-sandbox.yellow.com/faucet/requestTokens

### 4. Verify Setup

Check the server logs for:
```
🤖 Initializing agent wallet manager...
✅ Initialized Orchestrator Agent: 0x...
✅ Initialized Researcher Agent: 0x...
✅ Initialized Writer Agent: 0x...
🔌 Initializing Yellow clients for agents...
✅ All agent Yellow clients initialized
```

## Usage

### Feature Flag

The agent wallets feature is controlled by the `ENABLE_AGENT_WALLETS` environment variable:

- `true`: Use agent-owned wallets (agents have their own keys and balances)
- `false`: Use platform-controlled model (platform controls all payments)

### Payment Flow

**With Agent Wallets Enabled:**

1. User creates task session with budget (e.g., 5 USDC)
2. Platform funds each agent from user's wallet:
   - Orchestrator: 1.0 USDC (20%)
   - Researcher: 2.0 USDC (40%)
   - Writer: 2.0 USDC (40%)
3. Orchestrator breaks down task
4. Orchestrator pays Researcher (0.02 USDC) for research
5. Researcher completes research
6. Orchestrator pays Writer (0.02 USDC) for writing
7. Writer completes writing
8. Agents retain remaining balances for future tasks

**With Agent Wallets Disabled:**

Falls back to the original platform-controlled model where the platform manages all payments.

## API Changes

The task submission API (`/api/task`) now:

1. Checks if agent wallets are enabled
2. Initializes agent wallets on first use
3. Uses agent-to-agent transfers for payments
4. Falls back gracefully if initialization fails
5. Logs which payment model is active

## Security

- Private keys are stored in server-side environment variables only
- Keys are never exposed to client-side code
- Signing occurs server-side only
- All API communications use HTTPS

## Troubleshooting

### "Missing agent private keys in environment variables"

Make sure you've added all three private keys to `.env.local` and restarted the server.

### "Agent wallet manager not initialized"

The system will automatically initialize on first use. Check server logs for initialization errors.

### "Failed to initialize agent wallets"

The system will fall back to platform-controlled model. Check:
1. Private keys are valid hex strings (66 characters including '0x')
2. Yellow Network clearnode is accessible
3. Server logs for detailed error messages

### Agents have zero balance

Request test tokens from Yellow's faucet for each agent address.

## Development

### File Structure

```
agentpay/src/lib/
├── agent-wallet-manager.ts      # Wallet management
├── agent-yellow-client.ts       # Yellow Network integration
├── agent-funding-service.ts     # Funding logic
└── agent-transfer-service.ts    # Transfer logic

agentpay/src/app/api/task/
└── route.ts                     # Updated API endpoint

agentpay/scripts/
└── generate-agent-keys.js       # Key generation utility
```

### Testing

1. Enable agent wallets in `.env.local`
2. Restart server
3. Submit a task
4. Check server logs for agent initialization and transfers
5. Verify balances update correctly

## Future Enhancements

- ENS names for agent identities
- Balance persistence across sessions
- Agent earnings dashboard
- Marketplace for independent agent developers
- Cross-chain funding via LI.FI

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure Yellow Network testnet is accessible
4. Review the spec in `.kiro/specs/agent-owned-wallets/`
