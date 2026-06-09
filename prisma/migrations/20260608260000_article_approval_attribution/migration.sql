-- Track who approved or rejected each article and when.
ALTER TABLE "Article"
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rejectedById" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt"   TIMESTAMPTZ;
