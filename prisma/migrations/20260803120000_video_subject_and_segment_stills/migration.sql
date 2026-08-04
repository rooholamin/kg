-- Per-segment start frames for avatar segments (derived from the anchor), plus
-- a canonical subject description so independently generated b-roll frames stop
-- inventing a different closet/wall/fixture in every shot.

ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "subjectAnchor" TEXT;
ALTER TABLE "VideoSegment" ADD COLUMN IF NOT EXISTS "stillReferenceOrder" INTEGER;
