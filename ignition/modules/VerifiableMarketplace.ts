/**
 * Hardhat Ignition Module for VerifiableMarketplace
 * Deploys the marketplace contract to Base Sepolia
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * VerifiableMarketplace Deployment Module
 *
 * Usage:
 *   npx hardhat ignition deploy ignition/modules/VerifiableMarketplace.ts --network base-sepolia
 */
const VerifiableMarketplaceModule = buildModule("VerifiableMarketplaceModule", (m) => {
  // Deploy VerifiableMarketplace contract
  // Constructor takes no parameters - owner is set to msg.sender (deployer)
  const marketplace = m.contract("VerifiableMarketplace", []);

  // Return deployed contract instance
  return { marketplace };
});

export default VerifiableMarketplaceModule;
