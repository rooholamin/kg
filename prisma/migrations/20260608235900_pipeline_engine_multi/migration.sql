-- Add new columns to PipelineEngine
ALTER TABLE "PipelineEngine"
  ADD COLUMN IF NOT EXISTS "delayMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastJobCompletedAt" TIMESTAMP(3);

-- Add engineId to PipelineEngineLog (nullable — null = legacy single-engine logs)
ALTER TABLE "PipelineEngineLog"
  ADD COLUMN IF NOT EXISTS "engineId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PipelineEngineLog_engineId_idx" ON "PipelineEngineLog"("engineId");

-- Migrate: remove old singleton row, create 3 typed engine rows
DELETE FROM "PipelineEngine" WHERE "id" = 'singleton';

INSERT INTO "PipelineEngine" ("id", "status", "delayMinutes", "totalProcessed", "totalFailed", "updatedAt")
VALUES
  ('research', 'idle', 0, 0, 0, NOW()),
  ('writing',  'idle', 0, 0, 0, NOW()),
  ('images',   'idle', 0, 0, 0, NOW())
ON CONFLICT ("id") DO NOTHING;
