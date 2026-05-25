-- CreateEnum
CREATE TYPE "IdeaPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('new', 'under_consideration', 'accepted', 'rejected', 'parked');

-- CreateTable
CREATE TABLE "IdeaBacklog" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "IdeaPriority" NOT NULL DEFAULT 'medium',
    "status" "IdeaStatus" NOT NULL DEFAULT 'new',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaBacklog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaBacklog_priority_idx" ON "IdeaBacklog"("priority");

-- CreateIndex
CREATE INDEX "IdeaBacklog_status_idx" ON "IdeaBacklog"("status");

-- CreateIndex
CREATE INDEX "IdeaBacklog_createdAt_idx" ON "IdeaBacklog"("createdAt");
