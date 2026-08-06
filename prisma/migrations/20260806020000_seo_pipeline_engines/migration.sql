-- Article: "seo" engine (on-page optimization) + "kingsgate-linking" engine
-- (batch-of-N selective backlink) done-flags. Deliberately booleans, not new
-- ArticleStatus enum values — post_publish keeps its existing meaning
-- everywhere else in the app (see PRODUCT_OVERVIEW.md SEO milestone notes).
ALTER TABLE "Article"
  ADD COLUMN IF NOT EXISTS "seoOptimized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "seoOptimizedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "linkReviewed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "linkReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "kingsgateLinkUrl" TEXT;

-- PipelineEngine: support batch-style engines (claim several articles per
-- step instead of one via currentArticleId). Empty for single-article engines.
ALTER TABLE "PipelineEngine"
  ADD COLUMN IF NOT EXISTS "currentBatchArticleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE IF NOT EXISTS "SeoOptimizationRun" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'running',
    "previousTitle" TEXT,
    "previousMeta" TEXT,
    "changesSummary" TEXT,
    "agentSessionId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoOptimizationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KingsgateLinkingBatchRun" (
    "id" TEXT NOT NULL,
    "articleIds" TEXT[],
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'running',
    "selectedArticleId" TEXT,
    "matchedFeature" TEXT,
    "linkedPostUrl" TEXT,
    "reasoning" TEXT,
    "agentSessionId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KingsgateLinkingBatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SeoSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "seoAgentId" TEXT,
    "seoEnvironmentId" TEXT,
    "linkingAgentId" TEXT,
    "linkingEnvironmentId" TEXT,
    "mcpVaultId" TEXT,
    "linkingBatchSize" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SeoOptimizationRun_articleId_idx" ON "SeoOptimizationRun"("articleId");
CREATE INDEX IF NOT EXISTS "SeoOptimizationRun_status_idx" ON "SeoOptimizationRun"("status");
CREATE INDEX IF NOT EXISTS "SeoOptimizationRun_createdAt_idx" ON "SeoOptimizationRun"("createdAt");

CREATE INDEX IF NOT EXISTS "KingsgateLinkingBatchRun_status_idx" ON "KingsgateLinkingBatchRun"("status");
CREATE INDEX IF NOT EXISTS "KingsgateLinkingBatchRun_selectedArticleId_idx" ON "KingsgateLinkingBatchRun"("selectedArticleId");
CREATE INDEX IF NOT EXISTS "KingsgateLinkingBatchRun_createdAt_idx" ON "KingsgateLinkingBatchRun"("createdAt");

-- AddForeignKey
ALTER TABLE "SeoOptimizationRun"
  ADD CONSTRAINT "SeoOptimizationRun_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the two new engine rows (idempotent — matches the pattern used when
-- research/writing/images were introduced)
INSERT INTO "PipelineEngine" ("id", "status", "delayMinutes", "totalProcessed", "totalFailed", "updatedAt")
VALUES
  ('seo', 'idle', 0, 0, 0, NOW()),
  ('kingsgate-linking', 'idle', 0, 0, 0, NOW())
ON CONFLICT ("id") DO NOTHING;
