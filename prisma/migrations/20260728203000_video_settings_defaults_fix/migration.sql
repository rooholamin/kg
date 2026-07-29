-- Gap fix found during a plan-vs-implementation audit: VideoSettings never
-- got a working default caption template, so "Re-assemble" with the default
-- captionsEnabled=true would always hard-fail (addCaptions requires a
-- templateId). Backfills the real "Aries" template ID confirmed during
-- testing, and adds the ElevenLabs music model ID as a real setting
-- (was previously hardcoded 'music_v2' in application code).
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "elevenlabsMusicModelId" TEXT NOT NULL DEFAULT 'music_v2';

ALTER TABLE "VideoSettings" ALTER COLUMN "captionsTemplateId" SET DEFAULT 'ctpl_pUtOSPltDzsoYJgLBYmo';

-- Backfill any existing singleton row created before this default existed
UPDATE "VideoSettings" SET "captionsTemplateId" = 'ctpl_pUtOSPltDzsoYJgLBYmo' WHERE "captionsTemplateId" IS NULL;
