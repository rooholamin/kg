-- AlterTable: add AI planning fields to Article
ALTER TABLE "Article"
  ADD COLUMN "articleAngle" TEXT,
  ADD COLUMN "seoKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "outline" JSONB,
  ADD COLUMN "featuredImagePrompt" TEXT,
  ADD COLUMN "inlineImagePrompts" JSONB,
  ADD COLUMN "videoIdea" TEXT;
