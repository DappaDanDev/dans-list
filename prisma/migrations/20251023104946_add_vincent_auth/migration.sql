-- DropIndex
DROP INDEX "public"."Listing_embedding_idx";

-- DropIndex
DROP INDEX "public"."Listing_searchTags_gin_idx";

-- CreateTable
CREATE TABLE "vincent_auth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "authData" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT,

    CONSTRAINT "vincent_auth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vincent_auth_userId_key" ON "vincent_auth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vincent_auth_agentId_key" ON "vincent_auth"("agentId");

-- CreateIndex
CREATE INDEX "vincent_auth_walletAddress_idx" ON "vincent_auth"("walletAddress");

-- CreateIndex
CREATE INDEX "vincent_auth_agentId_idx" ON "vincent_auth"("agentId");

-- AddForeignKey
ALTER TABLE "vincent_auth" ADD CONSTRAINT "vincent_auth_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
