-- Segment version history. Regenerating a segment used to overwrite the clip
-- and delete the old file from S3; now every take is kept and restorable.

DO $$ BEGIN
  CREATE TYPE "VideoSegmentVersionSource" AS ENUM ('generated', 'manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "VideoSegmentVersion" (
  "id"              TEXT NOT NULL,
  "segmentId"       TEXT NOT NULL,
  "version"         INTEGER NOT NULL,
  "videoUrl"        TEXT,
  "duration"        DOUBLE PRECISION,
  "higgsfieldJobId" TEXT,
  "estimatedCost"   DOUBLE PRECISION,
  "source"          "VideoSegmentVersionSource" NOT NULL DEFAULT 'generated',
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoSegmentVersion_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "VideoSegmentVersion" ADD CONSTRAINT "VideoSegmentVersion_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "VideoSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "VideoSegmentVersion_segmentId_version_key" ON "VideoSegmentVersion"("segmentId", "version");
CREATE INDEX IF NOT EXISTS "VideoSegmentVersion_segmentId_idx" ON "VideoSegmentVersion"("segmentId");

ALTER TABLE "VideoSegment" ADD COLUMN IF NOT EXISTS "activeVersionId" TEXT;

-- Backfill: every segment that already has a clip gets that clip as version 1,
-- so existing posts show a coherent history instead of an empty one.
INSERT INTO "VideoSegmentVersion" ("id", "segmentId", "version", "videoUrl", "duration", "higgsfieldJobId", "estimatedCost", "source", "note", "createdAt")
SELECT gen_random_uuid(), s."id", 1, s."videoUrl", s."duration", s."higgsfieldJobId", s."estimatedCost", 'generated', NULL, s."createdAt"
FROM "VideoSegment" s
WHERE s."videoUrl" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "VideoSegmentVersion" v WHERE v."segmentId" = s."id");

UPDATE "VideoSegment" s
SET "activeVersionId" = v."id"
FROM "VideoSegmentVersion" v
WHERE v."segmentId" = s."id" AND v."version" = 1 AND s."activeVersionId" IS NULL;
