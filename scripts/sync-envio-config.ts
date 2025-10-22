import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loggers } from '../src/lib/utils/logger';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DeploymentInfo {
  marketplace?: string;
  agentRegistry?: string;
  [key: string]: string | undefined;
}

/**
 * Sync Envio configuration with deployed contract addresses
 * This script reads the deployed addresses from Hardhat Ignition and
 * generates the Envio config with real addresses
 */
async function syncEnvioConfig() {
  const logger = loggers.envio;

  logger.info('Starting Envio configuration sync');

  try {
    // Check if local deployment exists
    const deploymentPath = path.join(__dirname, '../ignition/deployments/local/deployed_addresses.json');

    let deploymentInfo: DeploymentInfo = {};

    if (fs.existsSync(deploymentPath)) {
      logger.info('Found local deployment file');
      const deploymentData = fs.readFileSync(deploymentPath, 'utf8');
      deploymentInfo = JSON.parse(deploymentData);
      logger.info({ addresses: deploymentInfo }, 'Loaded deployment addresses');
    } else {
      logger.error('No deployment found. Please deploy contracts first.');
      throw new Error(
        'Cannot sync Envio configuration without deployed contracts.\n' +
        'Please run: npx hardhat ignition deploy ./ignition/modules/Marketplace.ts --network local\n' +
        'This script requires real deployed contract addresses.'
      );
    }

    // Read ABI files
    const marketplaceAbiPath = path.join(__dirname, '../artifacts/contracts/VerifiableMarketplace.sol/VerifiableMarketplace.json');
    const marketplaceAbiFile = './abis/VerifiableMarketplace.json';

    if (fs.existsSync(marketplaceAbiPath)) {
      // Copy ABI to envio directory
      const envioAbiDir = path.join(__dirname, '../envio/abis');
      if (!fs.existsSync(envioAbiDir)) {
        fs.mkdirSync(envioAbiDir, { recursive: true });
      }

      const abiData = JSON.parse(fs.readFileSync(marketplaceAbiPath, 'utf8'));
      fs.writeFileSync(
        path.join(envioAbiDir, 'VerifiableMarketplace.json'),
        JSON.stringify(abiData.abi, null, 2)
      );
      logger.info('Copied ABI files to envio/abis directory');
    }

    // Validate required addresses
    if (!deploymentInfo.marketplace) {
      throw new Error('Marketplace contract address not found in deployment. Please ensure contract is deployed.');
    }

    // Generate Envio config
    const envioConfig = `name: DansListMarketplace
description: AI Agent Marketplace Activity Tracker
networks:
  - id: 31337  # Local Hardhat
    start_block: 0
    contracts:
      - name: VerifiableMarketplace
        address: "${deploymentInfo.marketplace}"
        abi_file_path: ${marketplaceAbiFile}
        handler: ./src/EventHandlers.ts
        events:
          - event: ListingCreated
          - event: PurchaseInitiated
          - event: AgentRegistered
  - id: 421614  # Arbitrum Sepolia
    start_block: 0
    contracts:
      - name: VerifiableMarketplace
        address: "\${MARKETPLACE_ADDRESS_ARBITRUM_SEPOLIA}"
        abi_file_path: ${marketplaceAbiFile}
        handler: ./src/EventHandlers.ts
        events:
          - event: ListingCreated
          - event: PurchaseInitiated
          - event: AgentRegistered

# GraphQL schema location
schema_path: ./schema.graphql

# Event handlers location
handler_path: ./src/EventHandlers.ts
`;

    // Write config file
    const configPath = path.join(__dirname, '../envio/config.yaml');
    fs.writeFileSync(configPath, envioConfig);
    logger.info({ path: configPath }, 'Generated Envio configuration');

    // Generate GraphQL schema (no aiProofHash references)
    const graphqlSchema = `type Agent @entity {
  id: ID!
  walletAddress: String!
  totalListings: Int!
  totalPurchases: Int!
  totalVolume: BigInt!
  lastActivity: BigInt!
  chainId: Int!
  createdAt: BigInt!
}

type MarketMetrics @entity {
  id: ID!
  totalListings: Int!
  totalVolume: BigInt!
  activeAgents24h: Int!
  averagePrice: BigInt!
  totalTransactions: Int!
  lastUpdated: BigInt!
}

type ListingEvent @entity {
  id: ID!
  listingId: String!
  type: String!
  agentId: String!
  seller: String!
  price: BigInt!
  timestamp: BigInt!
  chainId: Int!
  transactionHash: String!
  blockNumber: BigInt!
}

type PurchaseEvent @entity {
  id: ID!
  listingId: String!
  buyer: String!
  seller: String!
  amount: BigInt!
  timestamp: BigInt!
  chainId: Int!
  transactionHash: String!
  blockNumber: BigInt!
}

type AgentRegistration @entity {
  id: ID!
  agentId: String!
  walletAddress: String!
  timestamp: BigInt!
  chainId: Int!
  transactionHash: String!
  blockNumber: BigInt!
}
`;

    const schemaPath = path.join(__dirname, '../envio/schema.graphql');
    fs.writeFileSync(schemaPath, graphqlSchema);
    logger.info({ path: schemaPath }, 'Generated GraphQL schema');

    logger.info('✅ Envio configuration sync completed successfully');

    return {
      success: true,
      marketplace: deploymentInfo.marketplace,
      configPath,
      schemaPath
    };

  } catch (error) {
    logger.error({ err: error }, 'Failed to sync Envio configuration');
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncEnvioConfig()
    .then(result => {
      console.log('Sync completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Sync failed:', error);
      process.exit(1);
    });
}

export { syncEnvioConfig };