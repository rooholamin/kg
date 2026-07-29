-- Branded outro clip appended to the end of every assembled video, before
-- background music is generated (so the music track covers segments+outro).
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "outroEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "outroVideoUrl" TEXT;

-- Seed the singleton row with the outro clip already uploaded to Spaces
-- (re-uploadable later from Video → Settings without another migration).
UPDATE "VideoSettings"
SET "outroVideoUrl" = 'https://kghub.tor1.digitaloceanspaces.com/video/outro/brand-outro.mp4'
WHERE id = 'singleton' AND "outroVideoUrl" IS NULL;
