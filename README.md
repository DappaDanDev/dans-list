# Dan's List - AI Agent Marketplace

A decentralized marketplace for buying and selling AI agent access, built with Base Sepolia, Envio indexing, and autonomous payment systems.

## Features

- **Vincent Wallet Integration**: Autonomous AI agent wallets powered by Lit Protocol
- **Nexus Cross-Chain Payments**: Seamless cross-chain transactions via Avail Nexus
- **Real-time Indexing**: Event-driven architecture with Envio GraphQL indexer
- **Transaction Monitoring**: Blockscout SDK integration for transaction tracking
- **Policy Enforcement**: Agent-specific spending limits and approval workflows

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, TailwindCSS
- **Smart Contracts**: Solidity, Hardhat, Viem
- **Blockchain**: Base Sepolia (chainId: 84532)
- **Indexing**: Envio GraphQL indexer
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenAI GPT-4 for agent intelligence
- **Wallets**: Vincent SDK (Lit Protocol)
- **Cross-Chain**: Nexus SDK (Avail)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- A wallet with Base Sepolia testnet ETH
- API Keys:
  - OpenAI API key
  - Basescan API key (for contract verification)
  - Base Sepolia RPC endpoint (default: https://sepolia.base.org)

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd dans-list
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```env
# Required
OPENAI_API_KEY=sk-your-openai-api-key
DEPLOYER_PRIVATE_KEY=0xYourPrivateKey
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASESCAN_API_KEY=your-basescan-api-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dans_list

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOG_LEVEL=info
```

4. **Setup database**
```bash
# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

## Smart Contract Deployment

### Deploy to Base Sepolia

1. **Compile contracts**
```bash
npx hardhat compile
```

2. **Deploy marketplace contract**
```bash
tsx scripts/deploy-marketplace.ts --verify
```

This will:
- Deploy VerifiableMarketplace to Base Sepolia
- Verify the contract on Basescan
- Sync contract address with Envio indexer
- Save deployment info to `deployments/base-sepolia.json`

3. **Update environment with deployed address**
```bash
# Copy the deployed address and add to .env.local
MARKETPLACE_ADDRESS_BASE_SEPOLIA=0xYourDeployedAddress
```

### Local Development (Hardhat Network)

1. **Start local Hardhat node**
```bash
npx hardhat node
```

2. **Deploy to local network**
```bash
npx hardhat ignition deploy ignition/modules/VerifiableMarketplace.ts --network localhost
```

3. **Sync with Envio**
```bash
tsx scripts/sync-envio-config.ts --address 0xDeployedAddress
```

## Running the Application

### Start Development Server

```bash
npm run dev
```

Navigate to http://localhost:3000

### Start Envio Indexer

The Envio indexer processes blockchain events and provides a GraphQL API.

```bash
cd envio
envio dev
```

GraphQL playground will be available at http://localhost:8080/graphql

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Smart contract tests
npm test test/

# API route tests
npm test src/app/api/

# Deployment smoke tests
npm test scripts/__tests__/

# Vincent wallet tests
npm test src/lib/agents/__tests__/vincent

# Nexus integration tests
npm test src/lib/payment/__tests__/
```

### Test Coverage

```bash
npm run test:coverage
```

## Project Structure

```
dans-list/
├── contracts/              # Solidity smart contracts
│   └── VerifiableMarketplace.sol
├── ignition/              # Hardhat Ignition deployment modules
│   └── modules/
├── scripts/               # Deployment and utility scripts
│   ├── deploy-marketplace.ts
│   └── sync-envio-config.ts
├── envio/                 # Envio indexer configuration
│   ├── config.yaml
│   ├── schema.graphql
│   └── src/EventHandlers.ts
├── src/
│   ├── app/              # Next.js app router
│   │   ├── api/          # API routes
│   │   └── components/   # React components
│   ├── lib/
│   │   ├── agents/       # Vincent wallet integration
│   │   ├── payment/      # Nexus payment system
│   │   └── database/     # Prisma client
├── prisma/               # Database schema and migrations
└── test/                 # Smart contract tests
```

## Deployment Workflow

1. **Development**: Test locally with Hardhat network
2. **Deploy Contracts**: Deploy to Base Sepolia testnet
3. **Verify Contracts**: Verify on Basescan
4. **Sync Indexer**: Update Envio configuration with contract address
5. **Start Services**: Run Next.js app and Envio indexer
6. **Monitor**: Use Blockscout for transaction tracking

## Key Endpoints

### API Routes

- `POST /api/listings` - Create new AI agent listing
- `GET /api/listings` - Get all listings
- `POST /api/listings/[id]/purchase` - Purchase agent access
- `POST /api/webhooks/nexus` - Nexus transaction webhook
- `GET /api/agents/[address]/transactions` - Get agent transaction history

### GraphQL (Envio)

```graphql
query GetMarketMetrics {
  marketMetrics {
    totalListings
    totalVolume
    activeAgents24h
    averagePrice
  }
}

query GetAgentActivity {
  agents {
    walletAddress
    totalListings
    totalPurchases
    totalVolume
  }
}
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for agent intelligence | Yes |
| `DEPLOYER_PRIVATE_KEY` | Private key for contract deployment | Yes (deployment only) |
| `BASE_SEPOLIA_RPC` | Base Sepolia RPC endpoint | Yes |
| `BASESCAN_API_KEY` | Basescan API key for verification | No (recommended) |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `MARKETPLACE_ADDRESS_BASE_SEPOLIA` | Deployed marketplace address | Yes (production) |
| `VINCENT_LIT_NETWORK` | Lit Network: cayenne/mainnet | Yes |
| `NEXUS_NETWORK` | Nexus network: testnet/mainnet | Yes |
| `LOG_LEVEL` | Logging level: debug/info/warn/error | No |

## Troubleshooting

### Contract Deployment Fails

- Ensure wallet has sufficient Base Sepolia ETH
- Check `DEPLOYER_PRIVATE_KEY` is set correctly
- Verify RPC endpoint is accessible

### Envio Indexer Not Syncing

- Verify contract address in `envio/config.yaml`
- Check that contract is deployed and verified
- Restart indexer: `cd envio && envio dev`

### Transaction Monitoring Issues

- Verify Blockscout service configuration
- Check transaction hash format (0x prefix)
- Ensure network matches (Base Sepolia chainId: 84532)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT