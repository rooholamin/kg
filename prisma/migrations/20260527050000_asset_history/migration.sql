-- Add version column to ArticleAssetRequest
ALTER TABLE "ArticleAssetRequest" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Create ArticleAssetHistory table
CREATE TABLE "ArticleAssetHistory" (
    "id" TEXT NOT NULL,
    "assetRequestId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "prompt" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleAssetHistory_pkey" PRIMARY KEY ("id")
);

-- Index for efficient lookups
CREATE INDEX "ArticleAssetHistory_assetRequestId_idx" ON "ArticleAssetHistory"("assetRequestId");

-- Foreign key with cascade delete
ALTER TABLE "ArticleAssetHistory" ADD CONSTRAINT "ArticleAssetHistory_assetRequestId_fkey"
    FOREIGN KEY ("assetRequestId") REFERENCES "ArticleAssetRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
