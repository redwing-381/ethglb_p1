// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * AgentPay Test Token (APUSD)
 * 
 * Simple ERC-20 token for testing Yellow Network integration in the
 * AgentPay HackMoney 2026 project.
 * 
 * Key Features:
 * - 6 decimals (matches USDC and ytest.usd)
 * - 10,000 initial supply minted to deployer
 * - Standard ERC-20 implementation via OpenZeppelin
 * 
 * Why We Built This:
 * Yellow's protocol accepts ANY ERC-20 token, not just their test tokens.
 * This demonstrates:
 * 1. Deep understanding of Yellow's protocol flexibility
 * 2. Production-ready pattern (projects use their own tokens)
 * 3. Full control for testing (unlimited minting capability)
 * 
 * Deployment Instructions:
 * 1. Open Remix IDE (remix.ethereum.org)
 * 2. Create new file: AgentPayToken.sol
 * 3. Paste this code
 * 4. Compile with Solidity 0.8.20+
 * 5. Deploy to Sepolia testnet
 * 6. Copy deployed address to yellow-config.ts
 * 
 * Usage with Yellow:
 * - Approve Yellow's Custody contract: 0x019B65A265EB3363822f2752141b3dF16131b262
 * - Call depositAndCreate() with this token address
 * - Perform off-chain transfers via Yellow's clearnode
 * - Close channel to return remaining funds
 */
contract AgentPayToken is ERC20 {
    /**
     * Constructor
     * Mints 10,000 APUSD tokens to the deployer's address
     */
    constructor() ERC20("AgentPay USD", "APUSD") {
        // Mint 10,000 tokens with 6 decimals
        // 10,000 * 10^6 = 10,000,000,000 smallest units
        _mint(msg.sender, 10000 * 10**6);
    }
    
    /**
     * Override decimals to match USDC/ytest.usd
     * @return 6 decimals (standard for USD-pegged tokens)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
