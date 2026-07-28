-- Video pipeline gained a real still->silent video->TTS narration->lipsync
-- chain (sync_so) instead of ambient-only sound design, so the actual
-- spoken script needs its own column, distinct from the visual shotList.
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "narration" TEXT;
