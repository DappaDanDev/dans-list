/**
 * Sync Envio Config Smoke Tests
 * Verifies deployment configuration sync functionality
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncEnvioConfig } from '../sync-envio-config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock logger to avoid console noise during tests
vi.mock('@/lib/utils/logger', () => ({
  loggers: {
    envio: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

describe('sync-envio-config', () => {
  const testAddress = '0x1234567890123456789012345678901234567890';
  const envioDir = path.join(__dirname, '../../envio');
  const configPath = path.join(envioDir, 'config.yaml');
  const schemaPath = path.join(envioDir, 'schema.graphql');
  const abisDir = path.join(envioDir, 'abis');

  // Store original files if they exist
  let originalConfig: string | null = null;
  let originalSchema: string | null = null;

  beforeEach(() => {
    // Backup existing config files if they exist
    if (fs.existsSync(configPath)) {
      originalConfig = fs.readFileSync(configPath, 'utf8');
    }
    if (fs.existsSync(schemaPath)) {
      originalSchema = fs.readFileSync(schemaPath, 'utf8');
    }
  });

  afterEach(() => {
    // Restore original files
    if (originalConfig !== null && fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, originalConfig);
    }
    if (originalSchema !== null && fs.existsSync(schemaPath)) {
      fs.writeFileSync(schemaPath, originalSchema);
    }
  });

  test('generates Envio config with CLI address', async () => {
    const result = await syncEnvioConfig(testAddress);

    expect(result.success).toBe(true);
    expect(result.marketplace).toBe(testAddress);
    expect(result.configPath).toBe(configPath);
    expect(result.schemaPath).toBe(schemaPath);

    // Verify config file was created
    expect(fs.existsSync(configPath)).toBe(true);

    // Verify config contains the test address
    const configContent = fs.readFileSync(configPath, 'utf8');
    expect(configContent).toContain(testAddress);
    expect(configContent).toContain('DansListMarketplace');
    expect(configContent).toContain('VerifiableMarketplace');
    expect(configContent).toContain('id: 31337'); // Local Hardhat
    expect(configContent).toContain('id: 84532'); // Base Sepolia
  });

  test('generates GraphQL schema with correct entities', async () => {
    const result = await syncEnvioConfig(testAddress);

    expect(result.success).toBe(true);

    // Verify schema file was created
    expect(fs.existsSync(schemaPath)).toBe(true);

    // Verify schema contains required entities
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    expect(schemaContent).toContain('type Agent @entity');
    expect(schemaContent).toContain('type MarketMetrics @entity');
    expect(schemaContent).toContain('type ListingEvent @entity');
    expect(schemaContent).toContain('type PurchaseEvent @entity');
    expect(schemaContent).toContain('type MarketplaceFeeEvent @entity');
    expect(schemaContent).toContain('type FundsWithdrawnEvent @entity');
  });

  test('creates abis directory if it does not exist', async () => {
    // Remove abis directory if it exists
    if (fs.existsSync(abisDir)) {
      fs.rmSync(abisDir, { recursive: true });
    }

    await syncEnvioConfig(testAddress);

    // Verify abis directory was created
    expect(fs.existsSync(abisDir)).toBe(true);
  });

  test('copies ABI files when artifacts exist', async () => {
    const artifactsPath = path.join(__dirname, '../../artifacts/contracts/VerifiableMarketplace.sol/VerifiableMarketplace.json');

    // Skip if artifacts don't exist (not compiled yet)
    if (!fs.existsSync(artifactsPath)) {
      console.log('⚠️  Skipping ABI copy test - contract not compiled');
      return;
    }

    await syncEnvioConfig(testAddress);

    const abiPath = path.join(abisDir, 'VerifiableMarketplace.json');
    expect(fs.existsSync(abiPath)).toBe(true);

    // Verify it's valid JSON
    const abiContent = fs.readFileSync(abiPath, 'utf8');
    expect(() => JSON.parse(abiContent)).not.toThrow();
  });

  test('throws error when no address provided and no deployment exists', async () => {
    const deploymentPath = path.join(__dirname, '../../ignition/deployments/local/deployed_addresses.json');

    // Skip if deployment file exists
    if (fs.existsSync(deploymentPath)) {
      console.log('⚠️  Skipping no-address test - deployment file exists');
      return;
    }

    await expect(syncEnvioConfig()).rejects.toThrow(
      'Cannot sync Envio configuration without deployed contracts'
    );
  });

  test('handles invalid Ethereum addresses gracefully', async () => {
    const invalidAddress = '0xinvalid';

    // Should still generate config but with invalid address
    // (validation is deferred to Envio startup)
    const result = await syncEnvioConfig(invalidAddress);

    expect(result.success).toBe(true);
    expect(result.marketplace).toBe(invalidAddress);

    const configContent = fs.readFileSync(configPath, 'utf8');
    expect(configContent).toContain(invalidAddress);
  });

  test('config includes event handlers for all marketplace events', async () => {
    await syncEnvioConfig(testAddress);

    const configContent = fs.readFileSync(configPath, 'utf8');

    // Verify all expected events are configured
    expect(configContent).toContain('- event: ListingCreated');
    expect(configContent).toContain('- event: ListingPurchased');
    expect(configContent).toContain('- event: MarketplaceFeeUpdated');
    expect(configContent).toContain('- event: FundsWithdrawn');

    // Verify handler path is set
    expect(configContent).toContain('handler: ./src/EventHandlers.ts');
  });

  test('config includes both local and Base Sepolia networks', async () => {
    await syncEnvioConfig(testAddress);

    const configContent = fs.readFileSync(configPath, 'utf8');

    // Verify network configurations
    expect(configContent).toContain('id: 31337'); // Local
    expect(configContent).toContain('id: 84532'); // Base Sepolia

    // Verify Base Sepolia uses environment variable
    expect(configContent).toContain('${MARKETPLACE_ADDRESS_BASE_SEPOLIA}');
  });
});
