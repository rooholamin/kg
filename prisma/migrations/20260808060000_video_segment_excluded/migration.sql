-- Lets a bad shot be dropped from the cut without deleting the clip or its
-- version history, so it can be put back later.
ALTER TABLE "VideoSegment" ADD COLUMN IF NOT EXISTS "excluded" BOOLEAN NOT NULL DEFAULT false;
