-- Article Automation: Remove 'review' stage + add automation models

-- ============================================================
-- Step 1: Migrate existing 'review' articles → 'approval'
-- ============================================================
UPDATE "Article" SET "status" = 'approval' WHERE "status" = 'review';

-- ============================================================
-- Step 2: Add metaDescription field to Article
-- ============================================================
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;

-- ============================================================
-- Step 3: Rebuild ArticleStatus enum without 'review'
-- ============================================================
CREATE TYPE "ArticleStatus_new" AS ENUM (
  'planning',
  'research',
  'writing',
  'assets',
  'approval',
  'scheduling',
  'publishing',
  'post_publish'
);

-- Drop default first so ALTER TYPE can proceed
ALTER TABLE "Article" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Article"
  ALTER COLUMN "status" TYPE "ArticleStatus_new"
  USING "status"::text::"ArticleStatus_new";

-- Restore default using new enum type
ALTER TABLE "Article" ALTER COLUMN "status" SET DEFAULT 'planning'::"ArticleStatus_new";

DROP TYPE "ArticleStatus";
ALTER TYPE "ArticleStatus_new" RENAME TO "ArticleStatus";

-- ============================================================
-- Step 4: Asset request enums
-- ============================================================
CREATE TYPE "AssetRequestType" AS ENUM (
  'featured_image',
  'inline_image',
  'diagram',
  'chart',
  'social_asset'
);

CREATE TYPE "AssetRequestStatus" AS ENUM (
  'pending',
  'generating',
  'completed',
  'failed'
);

-- ============================================================
-- Step 5: Automation run enums
-- ============================================================
CREATE TYPE "AutomationRunWorkflow" AS ENUM (
  'research',
  'writing',
  'image_generation'
);

CREATE TYPE "AutomationRunStatus" AS ENUM (
  'running',
  'completed',
  'failed'
);

-- ============================================================
-- Step 6: ArticleResearch table (one-to-one per article)
-- ============================================================
CREATE TABLE "ArticleResearch" (
    "id"            TEXT NOT NULL,
    "articleId"     TEXT NOT NULL,
    "sources"       JSONB,
    "notes"         JSONB,
    "keyFacts"      JSONB,
    "searchQueries" JSONB,
    "summary"       TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleResearch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArticleResearch_articleId_fkey" FOREIGN KEY ("articleId")
        REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ArticleResearch_articleId_key" ON "ArticleResearch"("articleId");
CREATE INDEX "ArticleResearch_articleId_idx" ON "ArticleResearch"("articleId");

-- ============================================================
-- Step 7: ArticleAssetRequest table
-- ============================================================
CREATE TABLE "ArticleAssetRequest" (
    "id"           TEXT NOT NULL,
    "articleId"    TEXT NOT NULL,
    "type"         "AssetRequestType" NOT NULL,
    "prompt"       TEXT NOT NULL,
    "placementKey" TEXT NOT NULL,
    "status"       "AssetRequestStatus" NOT NULL DEFAULT 'pending',
    "imageUrl"     TEXT,
    "errorMessage" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleAssetRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArticleAssetRequest_articleId_fkey" FOREIGN KEY ("articleId")
        REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ArticleAssetRequest_articleId_idx" ON "ArticleAssetRequest"("articleId");
CREATE INDEX "ArticleAssetRequest_status_idx" ON "ArticleAssetRequest"("status");

-- ============================================================
-- Step 8: ArticleAutomationRun table
-- ============================================================
CREATE TABLE "ArticleAutomationRun" (
    "id"             TEXT NOT NULL,
    "articleId"      TEXT NOT NULL,
    "workflowType"   "AutomationRunWorkflow" NOT NULL,
    "n8nExecutionId" TEXT,
    "status"         "AutomationRunStatus" NOT NULL DEFAULT 'running',
    "input"          JSONB,
    "output"         JSONB,
    "errorMessage"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleAutomationRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArticleAutomationRun_articleId_fkey" FOREIGN KEY ("articleId")
        REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ArticleAutomationRun_articleId_idx" ON "ArticleAutomationRun"("articleId");
CREATE INDEX "ArticleAutomationRun_workflowType_idx" ON "ArticleAutomationRun"("workflowType");
CREATE INDEX "ArticleAutomationRun_status_idx" ON "ArticleAutomationRun"("status");
