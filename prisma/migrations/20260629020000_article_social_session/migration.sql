-- AlterTable: add shared Managed Agent session ID for social content generation
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "socialContentSessionId" TEXT;
