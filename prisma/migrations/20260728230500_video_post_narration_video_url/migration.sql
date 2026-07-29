-- Lets a "Regenerate Music" action reuse the already-assembled, pre-music
-- base render instead of re-downloading/re-normalizing/re-concatenating
-- every segment just to get a different music track.
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "narrationVideoUrl" TEXT;
