-- CreateEnum
CREATE TYPE "AIAttemptStatus" AS ENUM ('success', 'failed');

-- AlterTable
ALTER TABLE "ContentLog" ADD COLUMN     "action" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "createdBy" TEXT;

-- CreateIndex
CREATE INDEX "ContentLog_type_idx" ON "ContentLog"("type");

-- CreateTable
CREATE TABLE "ArticleVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" JSONB,
    "versionLabel" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleVersion_articleId_idx" ON "ArticleVersion"("articleId");

-- CreateIndex
CREATE INDEX "ArticleVersion_createdAt_idx" ON "ArticleVersion"("createdAt");

-- AddForeignKey
ALTER TABLE "ArticleVersion" ADD CONSTRAINT "ArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AIAttempt" (
    "id" TEXT NOT NULL,
    "articleId" TEXT,
    "prompt" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AIAttemptStatus" NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIAttempt_articleId_idx" ON "AIAttempt"("articleId");

-- CreateIndex
CREATE INDEX "AIAttempt_status_idx" ON "AIAttempt"("status");

-- CreateIndex
CREATE INDEX "AIAttempt_createdAt_idx" ON "AIAttempt"("createdAt");
