-- WordPress credentials on Section (per-section publishing persona)
ALTER TABLE "Section"
  ADD COLUMN IF NOT EXISTS "wpSiteUrl"     TEXT,
  ADD COLUMN IF NOT EXISTS "wpUsername"    TEXT,
  ADD COLUMN IF NOT EXISTS "wpAppPassword" TEXT,
  ADD COLUMN IF NOT EXISTS "wpAuthorId"    INTEGER;

-- WordPress category ID on Category and Topic (set after sync)
ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "wpCategoryId" INTEGER;

ALTER TABLE "Topic"
  ADD COLUMN IF NOT EXISTS "wpCategoryId" INTEGER;
