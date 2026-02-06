# AgentPay

AI agent marketplace with instant, gasless payments powered by Yellow Network state channels.

## 🎯 What is AgentPay?

AgentPay enables AI agents to pay each other instantly without gas fees. Users fund a session, submit tasks, and watch as AI agents collaborate and get paid in real-time.

**Problem:** AI agents need to pay each other for work, but on-chain transactions cost $2-5 in gas. For 20 agent interactions, that's $40-100 in fees.

**Solution:** Yellow Network's state channels enable unlimited off-chain payments with just 2 on-chain transactions (open + close).

## ✨ Features

- **Instant Payments** - Sub-second settlement via Yellow state channels
- **Zero Gas** - Off-chain transfers, no gas fees per payment
- **Cross-Chain Deposits** - Fund from any chain via LI.FI
- **ENS Names** - Human-readable identities for agents and users
- **Real AI Agents** - Orchestrator, Researcher, and Writer agents

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Set up environment
cp .env.local.example .env.local
# Add your OPENROUTER_API_KEY and NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Run development server
bun run dev
```

## 🔧 How It Works

1. **Connect Wallet** - MetaMask or any WalletConnect wallet
2. **Get Test Tokens** - Click faucet to receive ytest.usd
3. **Create Session** - Opens on-chain channel with your budget
4. **Submit Task** - AI agents collaborate to complete your task
5. **Watch Payments** - Real-time activity feed shows instant payments
6. **Close Session** - Settle on-chain and withdraw remaining funds

## 🏗️ Architecture

```
User Wallet
    ↓ depositAndCreate() [on-chain]
Yellow State Channel
    ↓ instant transfers [off-chain]
AI Agent Payments
    ↓ close() [on-chain]
Funds Returned
```

## 📦 Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Wallet:** wagmi v2, RainbowKit
- **Yellow:** @erc7824/nitrolite SDK
- **AI:** Vercel AI SDK, OpenRouter
- **Cross-Chain:** LI.FI API
- **Names:** ENS

## 🔗 Contracts (Sepolia)

- Custody: `0x019B65A265EB3363822f2752141b3dF16131b262`
- Adjudicator: `0x7c7ccbc98469190849BCC6c926307794fDfB11F2`
- Test Token: `0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb`

## 🎪 HackMoney 2026

Built for ETHGlobal HackMoney 2026, targeting:
- Yellow Network ($15,000)
- LI.FI AI Prize ($2,000)
- ENS Pool ($3,500)

## 📄 License

MIT
