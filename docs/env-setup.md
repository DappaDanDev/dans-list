# Environment Setup Guide

## Required API Keys and Services

### 1. OpenAI API Key
- **Purpose**: AI-powered image analysis for marketplace listings
- **Get from**: https://platform.openai.com/api-keys
- **Environment variable**: `OPENAI_API_KEY`
- **Format**: Starts with `sk-`
- **Required scopes**: GPT-4 Vision access

### 2. Envio API Token
- **Purpose**: Ultra-fast blockchain indexing and real-time market analytics
- **Get from**: https://app.envio.dev
- **Environment variable**: `ENVIO_API_KEY`
- **Format**: 32+ character string
- **Required for**: HyperSync indexing across multiple chains

### 3. Blockscout SDK
- **Purpose**: Transaction monitoring and wallet activity tracking
- **Package**: `@blockscout/app-sdk`
- **API Key Required**: No - SDK connects directly to Blockscout explorer instances
- **Features used**: Real-time transaction notifications, status updates, transaction history
- **Supported Networks**: Any blockchain with a Blockscout explorer instance (Ethereum, Polygon, Arbitrum, etc.)

### 4. RPC Endpoints
- **Purpose**: Blockchain connectivity for smart contract interactions
- **Providers**:
  - Alchemy: https://dashboard.alchemy.com
  - Infura: https://infura.io/dashboard
- **Environment variables**:
  - `ARBITRUM_SEPOLIA_RPC`: Arbitrum testnet endpoint
  - `ETHEREUM_RPC`: Ethereum mainnet for fork testing
- **Format**: `https://...` URL format

### 5. Database Connection
- **Purpose**: PostgreSQL database for marketplace data
- **Environment variable**: `DATABASE_URL`
- **Format**: `postgresql://user:password@host:5432/dans_list`
- **Options**:
  - Local PostgreSQL installation
  - Supabase (https://supabase.com)
  - Railway (https://railway.app)
  - Neon (https://neon.tech)

## Security Best Practices

1. **Never commit real keys**: Always use `.env.local` (already in `.gitignore`)
2. **Use placeholder values** in `.env.example` for documentation
3. **Secret management**: For production, use:
   - Vercel Environment Variables
   - AWS Secrets Manager
   - HashiCorp Vault
4. **Rotate keys regularly**: Especially after any potential exposure
5. **Principle of least privilege**: Only request necessary scopes/permissions

## Local Development Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your actual API keys in `.env.local`

3. Validate your configuration:
   ```bash
   npm run validate:env
   ```

## Testing Credentials

For integration tests that require real API connections:
- Use separate test API keys when possible
- Set rate limits appropriately
- Monitor usage to avoid unexpected costs
- Use testnet faucets for blockchain testing

## Troubleshooting

### Common Issues

1. **"Invalid API Key" errors**
   - Check for trailing spaces in `.env.local`
   - Ensure keys are properly quoted if they contain special characters
   - Verify the key hasn't expired or been rotated

2. **RPC Connection failures**
   - Check network connectivity
   - Verify RPC endpoint is for the correct network
   - Ensure rate limits haven't been exceeded

3. **Database connection issues**
   - Verify PostgreSQL is running (for local setup)
   - Check firewall/security group settings
   - Ensure database exists and user has proper permissions

## Required Testnet Tokens

For testing smart contract interactions:
- **Arbitrum Sepolia ETH**: https://www.alchemy.com/faucets/arbitrum-sepolia
- **Base Sepolia ETH**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

## Monitoring and Logging

All API calls are logged with structured logging (Pino). Check logs for:
- API response times
- Rate limit warnings
- Authentication failures
- Network errors

Log levels can be controlled via `LOG_LEVEL` environment variable:
- `debug`: Verbose logging for development
- `info`: Standard logging (default)
- `warn`: Warnings and errors only
- `error`: Errors only