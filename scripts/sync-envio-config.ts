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
    let marketplaceAbiFile = './abis/VerifiableMarketplace.json';

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
    const envioConfig = `name: DansList
description: AI-powered marketplace activity tracker
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
          - event: ListingPurchased
          - event: MarketplaceFeeUpdated
          - event: FundsWithdrawn
  - id: 421614  # Arbitrum Sepolia
    start_block: 0
    contracts:
      - name: VerifiableMarketplace
        address: "\${MARKETPLACE_ADDRESS_ARBITRUM_SEPOLIA}"
        abi_file_path: ${marketplaceAbiFile}
        handler: ./src/EventHandlers.ts
        events:
          - event: ListingCreated
          - event: ListingPurchased
          - event: MarketplaceFeeUpdated
`;

    // Write config file
    const configPath = path.join(__dirname, '../envio/config.yaml');
    fs.writeFileSync(configPath, envioConfig);
    logger.info({ path: configPath }, 'Generated Envio configuration');

    // Generate GraphQL schema
    const graphqlSchema = `type Agent @entity {
  id: ID!
  walletAddress: String!
  totalListings: BigInt!
  totalPurchases: BigInt!
  totalVolume: BigInt!
  lastActivity: BigInt!
  createdAt: BigInt!
}

type Listing @entity {
  id: ID!
  listingId: String! @index
  seller: Agent!
  price: BigInt!
  sold: Boolean!
  aiProofHash: Bytes!
  buyer: Agent
  createdAt: BigInt!
  soldAt: BigInt
}

type Transaction @entity {
  id: ID!
  hash: String! @index
  from: Agent!
  to: Agent!
  listing: Listing!
  amount: BigInt!
  timestamp: BigInt!
  blockNumber: BigInt!
}

type MarketMetrics @entity {
  id: ID!
  totalListings: BigInt!
  totalVolume: BigInt!
  totalAgents: BigInt!
  activeAgents24h: BigInt!
  averagePrice: BigInt!
  updatedAt: BigInt!
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