-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('AVAILABLE', 'PENDING', 'SOLD', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('BUYER', 'SELLER', 'MARKETPLACE', 'ARBITRATOR');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REVERTED');

-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('AI_ANALYSIS', 'AGENT_DECISION', 'PURCHASE', 'DISPUTE', 'DELIVERY');

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "price" DECIMAL(20,6) NOT NULL,
    "category" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "searchTags" TEXT[],
    "embedding" vector(1536),
    "embeddingModel" TEXT,
    "embeddingGeneratedAt" TIMESTAMP(3),
    "aiProofHash" TEXT,
    "sellerAgentId" TEXT NOT NULL,
    "buyerAgentId" TEXT,
    "contractAddress" TEXT,
    "chainId" INTEGER,
    "status" "ListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "type" "AgentType" NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "vincentPkpId" TEXT,
    "eigenAvsId" TEXT,
    "policies" JSONB NOT NULL,
    "spendingLimit" DECIMAL(20,6) NOT NULL,
    "dailyLimit" DECIMAL(20,6) NOT NULL,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "totalVolume" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "fromAgentId" TEXT NOT NULL,
    "toAgentId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "token" TEXT NOT NULL DEFAULT 'PYUSD',
    "sourceChain" INTEGER NOT NULL,
    "destinationChain" INTEGER NOT NULL,
    "nexusRouteId" TEXT,
    "nexusSteps" JSONB,
    "bridgeFee" DECIMAL(20,6),
    "swapFee" DECIMAL(20,6),
    "status" "TransactionStatus" NOT NULL,
    "blockNumber" BIGINT,
    "gasUsed" BIGINT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proof" (
    "id" TEXT NOT NULL,
    "type" "ProofType" NOT NULL,
    "hash" TEXT NOT NULL,
    "listingId" TEXT,
    "transactionId" TEXT,
    "agentId" TEXT,
    "data" JSONB NOT NULL,
    "signature" TEXT,
    "eigenAttestationId" TEXT,
    "eigenDaHash" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifierAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "jsonrpcId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "fromAgentId" TEXT NOT NULL,
    "result" JSONB,
    "error" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketMetrics" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "totalAgents" INTEGER NOT NULL DEFAULT 0,
    "activeAgents24h" INTEGER NOT NULL DEFAULT 0,
    "totalListings" INTEGER NOT NULL DEFAULT 0,
    "totalVolume24h" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "totalVolume7d" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "totalVolume30d" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "averageListingPrice" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "topCategory" TEXT,
    "chainMetrics" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "topics" TEXT[],
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Listing_status_category_idx" ON "Listing"("status", "category");

-- CreateIndex
CREATE INDEX "Listing_sellerAgentId_idx" ON "Listing"("sellerAgentId");

-- CreateIndex
CREATE INDEX "Listing_price_idx" ON "Listing"("price");

-- CreateIndex for pgvector - HNSW index for fast cosine similarity search
CREATE INDEX "Listing_embedding_idx" ON "Listing" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- CreateIndex for searchTags GIN
CREATE INDEX "Listing_searchTags_gin_idx" ON "Listing" USING GIN ("searchTags");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_walletAddress_key" ON "Agent"("walletAddress");

-- CreateIndex
CREATE INDEX "Agent_type_walletAddress_idx" ON "Agent"("type", "walletAddress");

-- CreateIndex
CREATE INDEX "Agent_lastActivity_idx" ON "Agent"("lastActivity");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_hash_key" ON "Transaction"("hash");

-- CreateIndex
CREATE INDEX "Transaction_status_fromAgentId_idx" ON "Transaction"("status", "fromAgentId");

-- CreateIndex
CREATE INDEX "Transaction_status_toAgentId_idx" ON "Transaction"("status", "toAgentId");

-- CreateIndex
CREATE INDEX "Transaction_hash_idx" ON "Transaction"("hash");

-- CreateIndex
CREATE INDEX "Transaction_listingId_idx" ON "Transaction"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Proof_hash_key" ON "Proof"("hash");

-- CreateIndex
CREATE INDEX "Proof_type_idx" ON "Proof"("type");

-- CreateIndex
CREATE INDEX "Proof_hash_idx" ON "Proof"("hash");

-- CreateIndex
CREATE INDEX "Proof_listingId_idx" ON "Proof"("listingId");

-- CreateIndex
CREATE INDEX "Proof_transactionId_idx" ON "Proof"("transactionId");

-- CreateIndex
CREATE INDEX "Message_fromAgentId_idx" ON "Message"("fromAgentId");

-- CreateIndex
CREATE INDEX "Message_method_idx" ON "Message"("method");

-- CreateIndex
CREATE INDEX "EventLog_eventType_processed_idx" ON "EventLog"("eventType", "processed");

-- CreateIndex
CREATE INDEX "EventLog_transactionHash_idx" ON "EventLog"("transactionHash");

-- CreateIndex
CREATE INDEX "EventLog_blockNumber_chainId_idx" ON "EventLog"("blockNumber", "chainId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerAgentId_fkey" FOREIGN KEY ("sellerAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_buyerAgentId_fkey" FOREIGN KEY ("buyerAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fromAgentId_fkey" FOREIGN KEY ("fromAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toAgentId_fkey" FOREIGN KEY ("toAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_fromAgentId_fkey" FOREIGN KEY ("fromAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
