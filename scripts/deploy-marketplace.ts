#!/usr/bin/env tsx

/**
 * VerifiableMarketplace Deployment Script
 * Deploys to Base Sepolia and syncs with Envio indexer
 *
 * Usage:
 *   tsx scripts/deploy-marketplace.ts
 *   tsx scripts/deploy-marketplace.ts --verify
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

interface DeploymentResult {
  address: string;
  deployer: string;
  transactionHash: string;
  blockNumber: number;
  network: string;
}

async function main() {
  const args = process.argv.slice(2);
  const shouldVerify = args.includes('--verify');
  const network = process.env.HARDHAT_NETWORK || 'base-sepolia';

  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}  VerifiableMarketplace Deployment${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}\n`);

  console.log(`${colors.blue}Network:${colors.reset} ${network}`);
  console.log(`${colors.blue}Verify:${colors.reset} ${shouldVerify ? 'Yes' : 'No'}\n`);

  // Check environment variables
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    console.error(`${colors.red}❌ DEPLOYER_PRIVATE_KEY not set in environment${colors.reset}`);
    process.exit(1);
  }

  if (!process.env.BASE_SEPOLIA_RPC) {
    console.warn(`${colors.yellow}⚠️  BASE_SEPOLIA_RPC not set, using default${colors.reset}`);
  }

  try {
    // Step 1: Deploy via Hardhat Ignition
    console.log(`${colors.yellow}📦 Deploying VerifiableMarketplace...${colors.reset}\n`);

    const deployCommand = `npx hardhat ignition deploy ignition/modules/VerifiableMarketplace.ts --network ${network} --json`;

    console.log(`${colors.cyan}Running:${colors.reset} ${deployCommand}\n`);

    const deployOutput = execSync(deployCommand, {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'inherit'],
    });

    // Parse Ignition deployment output
    // Ignition outputs JSON with deployment info
    const deploymentInfo = parseIgnitionOutput(deployOutput);

    if (!deploymentInfo?.address) {
      throw new Error('Failed to parse deployment address from Ignition output');
    }

    console.log(`\n${colors.green}✅ Contract deployed successfully!${colors.reset}\n`);
    console.log(`${colors.cyan}─────────────────────────────────────────${colors.reset}`);
    console.log(`  Address: ${colors.green}${deploymentInfo.address}${colors.reset}`);
    console.log(`  Network: ${network}`);
    console.log(`  Chain ID: 84532 (Base Sepolia)`);
    console.log(`${colors.cyan}─────────────────────────────────────────${colors.reset}\n`);

    // Step 2: Save deployment info
    console.log(`${colors.yellow}💾 Saving deployment info...${colors.reset}`);
    saveDeploymentInfo(deploymentInfo, network);
    console.log(`${colors.green}✅ Deployment info saved${colors.reset}\n`);

    // Step 3: Verify contract on Basescan (if requested)
    if (shouldVerify) {
      console.log(`${colors.yellow}🔍 Verifying contract on Basescan...${colors.reset}\n`);

      if (!process.env.BASESCAN_API_KEY) {
        console.warn(`${colors.yellow}⚠️  BASESCAN_API_KEY not set, skipping verification${colors.reset}\n`);
      } else {
        try {
          const verifyCommand = `npx hardhat verify --network ${network} ${deploymentInfo.address}`;
          console.log(`${colors.cyan}Running:${colors.reset} ${verifyCommand}\n`);

          execSync(verifyCommand, {
            encoding: 'utf-8',
            stdio: 'inherit',
          });

          console.log(`\n${colors.green}✅ Contract verified successfully!${colors.reset}\n`);
        } catch (error) {
          console.warn(`${colors.yellow}⚠️  Verification failed (may already be verified)${colors.reset}\n`);
        }
      }
    }

    // Step 4: Sync with Envio indexer
    console.log(`${colors.yellow}🔄 Syncing with Envio indexer...${colors.reset}\n`);

    try {
      const syncCommand = `tsx scripts/sync-envio-config.ts --address ${deploymentInfo.address}`;
      console.log(`${colors.cyan}Running:${colors.reset} ${syncCommand}\n`);

      execSync(syncCommand, {
        encoding: 'utf-8',
        stdio: 'inherit',
      });

      console.log(`\n${colors.green}✅ Envio config synced${colors.reset}\n`);
    } catch (error) {
      console.warn(`${colors.yellow}⚠️  Failed to sync Envio config${colors.reset}`);
      console.warn(`   Run manually: tsx scripts/sync-envio-config.ts --address ${deploymentInfo.address}\n`);
    }

    // Step 5: Display summary
    console.log(`${colors.green}========================================${colors.reset}`);
    console.log(`${colors.green}  🎉 Deployment Complete!${colors.reset}`);
    console.log(`${colors.green}========================================${colors.reset}\n`);

    console.log('Next steps:');
    console.log(`  1. Add contract address to .env.local:`);
    console.log(`     ${colors.cyan}MARKETPLACE_CONTRACT_ADDRESS=${deploymentInfo.address}${colors.reset}`);
    console.log(`  2. Restart Envio indexer:`);
    console.log(`     ${colors.cyan}cd envio && envio dev${colors.reset}`);
    console.log(`  3. View contract on Basescan:`);
    console.log(`     ${colors.cyan}https://sepolia.basescan.org/address/${deploymentInfo.address}${colors.reset}\n`);
  } catch (error) {
    console.error(`\n${colors.red}❌ Deployment failed:${colors.reset}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Parse Ignition deployment output to extract contract address
 */
function parseIgnitionOutput(output: string): DeploymentResult | null {
  try {
    // Ignition outputs deployment info in JSON format
    // Look for the deployed address in the output
    const lines = output.split('\n');

    for (const line of lines) {
      // Try to parse as JSON
      try {
        const json = JSON.parse(line);
        if (json.address || json.deployedTo) {
          return {
            address: json.address || json.deployedTo,
            deployer: json.deployer || 'unknown',
            transactionHash: json.transactionHash || json.txHash || '',
            blockNumber: json.blockNumber || 0,
            network: 'base-sepolia',
          };
        }
      } catch {
        // Not JSON, try regex parsing
        const addressMatch = line.match(/0x[a-fA-F0-9]{40}/);
        if (addressMatch) {
          return {
            address: addressMatch[0],
            deployer: 'unknown',
            transactionHash: '',
            blockNumber: 0,
            network: 'base-sepolia',
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to parse deployment output:', error);
    return null;
  }
}

/**
 * Save deployment info to JSON file
 */
function saveDeploymentInfo(info: DeploymentResult, network: string) {
  const deploymentsDir = path.join(process.cwd(), 'deployments');

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${network}.json`);

  const deploymentData = {
    network,
    chainId: 84532,
    contracts: {
      VerifiableMarketplace: {
        address: info.address,
        deployer: info.deployer,
        transactionHash: info.transactionHash,
        blockNumber: info.blockNumber,
        deployedAt: new Date().toISOString(),
      },
    },
  };

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

  console.log(`   Saved to: ${deploymentFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
