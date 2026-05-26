-- Milestone 8: Scheduling Engine

-- Add scheduling fields to Article
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "scheduleBatchId" TEXT;
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "scheduledSlotId" TEXT;
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "generationSource" TEXT;
CREATE INDEX IF NOT EXISTS "Article_scheduleBatchId_idx" ON "Article"("scheduleBatchId");
CREATE INDEX IF NOT EXISTS "Article_scheduledSlotId_idx" ON "Article"("scheduledSlotId");

-- ScheduleBatch status enum
CREATE TYPE "ScheduleBatchStatus" AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed');

-- ScheduledSlot status enum
CREATE TYPE "ScheduledSlotStatus" AS ENUM ('planned', 'sent_to_n8n', 'generating', 'completed', 'failed');

-- ScheduleBatch table
CREATE TABLE "ScheduleBatch" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "startDate"       TIMESTAMP(3) NOT NULL,
    "endDate"         TIMESTAMP(3) NOT NULL,
    "postsPerDay"     INTEGER NOT NULL,
    "status"          "ScheduleBatchStatus" NOT NULL DEFAULT 'draft',
    "totalSlots"      INTEGER NOT NULL DEFAULT 0,
    "completedSlots"  INTEGER NOT NULL DEFAULT 0,
    "failedSlots"     INTEGER NOT NULL DEFAULT 0,
    "sectionIds"      TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryIds"     TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeTopicIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pauseReason"     TEXT,
    "startedAt"       TIMESTAMP(3),
    "completedAt"     TIMESTAMP(3),
    "createdBy"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduleBatch_status_idx" ON "ScheduleBatch"("status");
CREATE INDEX "ScheduleBatch_createdAt_idx" ON "ScheduleBatch"("createdAt");

-- ScheduledArticleSlot table
CREATE TABLE "ScheduledArticleSlot" (
    "id"             TEXT NOT NULL,
    "batchId"        TEXT NOT NULL,
    "articleId"      TEXT,
    "sectionId"      TEXT,
    "categoryId"     TEXT NOT NULL,
    "topicId"        TEXT NOT NULL,
    "scheduledDate"  TIMESTAMP(3) NOT NULL,
    "status"         "ScheduledSlotStatus" NOT NULL DEFAULT 'planned',
    "n8nExecutionId" TEXT,
    "errorMessage"   TEXT,
    "planningData"   JSONB,
    "triggeredAt"    TIMESTAMP(3),
    "completedAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledArticleSlot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScheduledArticleSlot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ScheduleBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ScheduledArticleSlot_batchId_idx" ON "ScheduledArticleSlot"("batchId");
CREATE INDEX "ScheduledArticleSlot_topicId_idx" ON "ScheduledArticleSlot"("topicId");
CREATE INDEX "ScheduledArticleSlot_status_idx" ON "ScheduledArticleSlot"("status");
CREATE INDEX "ScheduledArticleSlot_scheduledDate_idx" ON "ScheduledArticleSlot"("scheduledDate");
