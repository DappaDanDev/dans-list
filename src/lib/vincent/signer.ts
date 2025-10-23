/**
 * VincentSigner - Ethers-compatible signer for Vincent PKP wallets
 * Bridges Vincent wallet operations into the ethers ecosystem
 */

import { Signer, Provider, TransactionRequest, TypedDataDomain, TypedDataField } from 'ethers';
import { VincentWalletService } from './wallet.service';
import { loggers } from '@/lib/utils/logger';

const logger = loggers.vincent;

/**
 * VincentSigner implements ethers.Signer interface
 * Allows Vincent PKP wallets to be used with standard ethers workflows
 * and the Nexus SDK (which requires an EIP-1193 provider)
 */
export class VincentSigner extends Signer {
  private agentId: string;
  private vincentService: VincentWalletService;
  private addressCache: string | null = null;

  constructor(
    agentId: string,
    provider?: Provider,
    vincentService?: VincentWalletService
  ) {
    super(provider);
    this.agentId = agentId;
    this.vincentService = vincentService || new VincentWalletService();
  }

  /**
   * Get the wallet address for this signer
   * Caches the address after first fetch
   */
  async getAddress(): Promise<string> {
    if (this.addressCache) {
      return this.addressCache;
    }

    try {
      logger.debug({ agentId: this.agentId }, 'Getting Vincent wallet address');

      const wallet = await this.vincentService.ensureWallet(this.agentId);
      this.addressCache = wallet.address;

      logger.debug({ agentId: this.agentId, address: wallet.address }, 'Address retrieved');

      return wallet.address;
    } catch (error) {
      logger.error({ err: error, agentId: this.agentId }, 'Failed to get address');
      throw new Error(`Failed to get Vincent wallet address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign a message with the Vincent PKP wallet
   * @param message - Message to sign (string or Uint8Array)
   * @returns Signature as hex string
   */
  async signMessage(message: string | Uint8Array): Promise<string> {
    try {
      const messageStr = typeof message === 'string'
        ? message
        : new TextDecoder().decode(message);

      logger.debug({ agentId: this.agentId, messageLength: messageStr.length }, 'Signing message');

      // Use Vincent's verifyWalletOwnership signature mechanism
      // For actual implementation, we'd call a dedicated signMessage method on VincentWalletService
      // For now, we'll use the existing signTypedData with a simple domain
      const signature = await this.vincentService.signTypedData({
        agentId: this.agentId,
        domain: {
          name: 'VincentSigner',
          version: '1',
          chainId: 84532, // Base Sepolia
        },
        types: {
          Message: [{ name: 'content', type: 'string' }],
        },
        value: {
          content: messageStr,
        },
      });

      logger.info({ agentId: this.agentId, signatureHash: signature.slice(0, 20) }, 'Message signed');

      return signature;
    } catch (error) {
      logger.error({ err: error, agentId: this.agentId }, 'Failed to sign message');
      throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign a transaction with the Vincent PKP wallet
   * @param transaction - Transaction to sign
   * @returns Signed transaction as hex string
   */
  async signTransaction(transaction: TransactionRequest): Promise<string> {
    try {
      logger.debug({
        agentId: this.agentId,
        to: transaction.to,
        value: transaction.value?.toString()
      }, 'Signing transaction');

      // NOTE: This is a placeholder implementation
      // Real implementation would use Lit Protocol's PKP signing for transactions
      // For now, throw an error indicating this needs implementation
      throw new Error('Transaction signing with Vincent PKP is not yet implemented. Use signTypedData for EIP-712 signatures.');

      // TODO: Implement actual transaction signing via Lit Protocol
      // This would require:
      // 1. Serializing the transaction
      // 2. Using PKP to sign the transaction hash
      // 3. Returning the signed transaction
    } catch (error) {
      logger.error({ err: error, agentId: this.agentId }, 'Failed to sign transaction');
      throw error;
    }
  }

  /**
   * Sign typed data (EIP-712) with the Vincent PKP wallet
   * @param domain - EIP-712 domain
   * @param types - EIP-712 types
   * @param value - Data to sign
   * @returns Signature as hex string
   */
  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    try {
      logger.debug({
        agentId: this.agentId,
        domainName: domain.name,
        typeKeys: Object.keys(types)
      }, 'Signing typed data');

      const signature = await this.vincentService.signTypedData({
        agentId: this.agentId,
        domain: {
          name: domain.name || 'Unknown',
          version: domain.version || '1',
          chainId: typeof domain.chainId === 'bigint'
            ? Number(domain.chainId)
            : domain.chainId || 84532,
          verifyingContract: domain.verifyingContract,
          salt: domain.salt,
        },
        types,
        value,
      });

      logger.info({
        agentId: this.agentId,
        signatureHash: signature.slice(0, 20)
      }, 'Typed data signed');

      return signature;
    } catch (error) {
      logger.error({ err: error, agentId: this.agentId }, 'Failed to sign typed data');
      throw new Error(`Failed to sign typed data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Connect this signer to a provider
   * @param provider - Ethers provider to connect
   * @returns New VincentSigner instance with provider attached
   */
  connect(provider: Provider): VincentSigner {
    return new VincentSigner(this.agentId, provider, this.vincentService);
  }

  /**
   * Get the agent ID associated with this signer
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Clear the address cache
   * Useful if the wallet is recreated or changed
   */
  clearAddressCache(): void {
    this.addressCache = null;
  }
}
