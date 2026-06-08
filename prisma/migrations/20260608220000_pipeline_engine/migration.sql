-- CreateEnum
CREATE TYPE "PipelineEngineStatus" AS ENUM ('idle', 'running', 'paused');

-- CreateTable
CREATE TABLE "PipelineEngine" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "status" "PipelineEngineStatus" NOT NULL DEFAULT 'idle',
    "pauseReason" TEXT,
    "currentArticleId" TEXT,
    "currentStep" TEXT,
    "totalProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineEngine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineEngineLog" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "steps" TEXT[],
    "status" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PipelineEngineLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineEngineLog_articleId_idx" ON "PipelineEngineLog"("articleId");

-- CreateIndex
CREATE INDEX "PipelineEngineLog_status_idx" ON "PipelineEngineLog"("status");

-- CreateIndex
CREATE INDEX "PipelineEngineLog_startedAt_idx" ON "PipelineEngineLog"("startedAt");

-- AddForeignKey
ALTER TABLE "PipelineEngineLog" ADD CONSTRAINT "PipelineEngineLog_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
