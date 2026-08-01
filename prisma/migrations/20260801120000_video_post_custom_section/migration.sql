-- A custom video can borrow an existing section's already-trained character
-- instead of a standalone roster character. Exactly one of customCharacterId
-- or customSectionId is set (application-enforced, not a DB constraint).

ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "customSectionId" TEXT;

DO $$ BEGIN
  ALTER TABLE "VideoPost" ADD CONSTRAINT "VideoPost_customSectionId_fkey" FOREIGN KEY ("customSectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "VideoPost_customSectionId_idx" ON "VideoPost"("customSectionId");
