#!/usr/bin/env tsx

/**
 * Create Agent Wallet CLI
 * Provisions a Vincent PKP wallet for an agent
 *
 * Usage:
 *   tsx scripts/create-agent-wallet.ts <agentId>
 *   tsx scripts/create-agent-wallet.ts agent_xyz123
 */

import { VincentWalletService } from '../src/lib/vincent/wallet.service';
import { getPrismaClient } from '../src/lib/database/prisma.service';

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

async function main() {
  const agentId = process.argv[2];

  if (!agentId) {
    console.error(`${colors.red}❌ Error: Agent ID is required${colors.reset}`);
    console.log('\nUsage:');
    console.log('  tsx scripts/create-agent-wallet.ts <agentId>');
    console.log('\nExample:');
    console.log('  tsx scripts/create-agent-wallet.ts agent_xyz123');
    process.exit(1);
  }

  try {
    console.log(`${colors.cyan}🔐 Creating Vincent wallet for agent: ${agentId}${colors.reset}\n`);

    // Check if agent exists
    const prisma = getPrismaClient();
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      console.error(`${colors.red}❌ Agent not found: ${agentId}${colors.reset}`);
      console.log('\nAvailable agents:');
      const agents = await prisma.agent.findMany({
        select: { id: true, type: true, walletAddress: true },
        take: 10,
      });
      agents.forEach((a) => {
        console.log(`  - ${a.id} (${a.type})${a.walletAddress ? ' [has wallet]' : ''}`);
      });
      process.exit(1);
    }

    // Check if agent already has a wallet
    if (agent.vincentPkpId) {
      console.log(`${colors.yellow}⚠️  Agent already has a wallet!${colors.reset}`);
      console.log(`   PKP ID: ${agent.vincentPkpId}`);
      console.log(`   Address: ${agent.walletAddress}`);
      console.log(`\nUse --force to recreate (not implemented for safety)`);
      process.exit(0);
    }

    // Create wallet
    console.log('Initializing Vincent wallet service...');
    const vincentService = new VincentWalletService();

    console.log('Creating PKP wallet (this may take a moment)...');
    const wallet = await vincentService.ensureWallet(agentId);

    // Display results
    console.log(`\n${colors.green}✅ Wallet created successfully!${colors.reset}\n`);
    console.log('Wallet Details:');
    console.log(`${colors.cyan}─────────────────────────────────────────${colors.reset}`);
    console.log(`  PKP ID:   ${wallet.pkpId}`);
    console.log(`  Address:  ${wallet.address}`);
    if (wallet.publicKey) {
      console.log(`  Public Key: ${wallet.publicKey.slice(0, 20)}...`);
    }
    console.log(`${colors.cyan}─────────────────────────────────────────${colors.reset}\n`);

    console.log('Policy Configuration:');
    console.log(`  Max Transaction:  ${wallet.policies.maxTransactionValue} wei`);
    console.log(`  Daily Limit:      ${wallet.policies.dailySpendingLimit} wei`);
    console.log(`  Max Gas Price:    ${wallet.policies.maxGasPrice} wei`);
    console.log(`  Allowed Tokens:   ${wallet.policies.allowedTokens.join(', ')}`);
    console.log(`  Approved Contracts: ${wallet.policies.approvedContractAddresses.length || 'None (will be set after deployment)'}`);

    console.log(`\n${colors.green}🎉 Agent is ready to transact!${colors.reset}\n`);

    // Cleanup
    await VincentWalletService.disconnect();
    await prisma.$disconnect();
  } catch (error) {
    console.error(`\n${colors.red}❌ Error creating wallet:${colors.reset}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
