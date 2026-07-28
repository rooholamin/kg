-- Directed Multi-Segment Narrated Videos: switches the video pipeline from a
-- single director call that produces one shotList + one video, to a
-- Plan -> Approve -> Execute workflow with per-segment tracking, so expensive
-- generations can be reviewed before they're spent and a single bad segment
-- can be regenerated without re-generating the whole video.

-- New enum values on existing status enums (safe on PG12+ within a transaction
-- as long as they aren't referenced by a DEFAULT in the same ALTER TYPE statement)
ALTER TYPE "VideoCampaignStatus" ADD VALUE IF NOT EXISTS 'planning';
ALTER TYPE "VideoPostStatus" ADD VALUE IF NOT EXISTS 'planning';
ALTER TYPE "VideoPostStatus" ADD VALUE IF NOT EXISTS 'plan_ready';
ALTER TYPE "VideoPostStatus" ADD VALUE IF NOT EXISTS 'approved';

-- New enums
DO $$ BEGIN
  CREATE TYPE "VideoSegmentStatus" AS ENUM ('pending', 'generating', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "VideoTargetPlatform" AS ENUM ('instagram_reels', 'tiktok', 'youtube_shorts', 'linkedin', 'auto');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "VideoStyle" AS ENUM ('auto', 'explainer', 'diy', 'listicle', 'testimonial');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- VideoCampaign: cycle-level Plan -> Approve -> Execute config defaults
ALTER TABLE "VideoCampaign" ADD COLUMN IF NOT EXISTS "targetPlatform" "VideoTargetPlatform" DEFAULT 'auto';
ALTER TABLE "VideoCampaign" ADD COLUMN IF NOT EXISTS "videoStyle" "VideoStyle" DEFAULT 'auto';
ALTER TABLE "VideoCampaign" ADD COLUMN IF NOT EXISTS "targetShotCount" INTEGER;
ALTER TABLE "VideoCampaign" ADD COLUMN IF NOT EXISTS "orientation" TEXT DEFAULT '9:16';

-- VideoPost: per-post config overrides + plan/segments/music/captions/cost-time tracking
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "targetPlatform" "VideoTargetPlatform";
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "videoStyle" "VideoStyle";
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "targetShotCount" INTEGER;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "orientation" TEXT;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "plan" JSONB;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "musicUrl" TEXT;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "musicVolume" DOUBLE PRECISION;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "captionsEnabled" BOOLEAN;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "totalGenerationTimeMs" INTEGER;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "totalEstimatedCost" DOUBLE PRECISION;

-- shotList/stillAssetUrl/higgsfieldJobId are superseded by `plan` + the
-- VideoSegment table (one row per segment, each with its own job id/still)
ALTER TABLE "VideoPost" DROP COLUMN IF EXISTS "shotList";
ALTER TABLE "VideoPost" DROP COLUMN IF EXISTS "stillAssetUrl";
ALTER TABLE "VideoPost" DROP COLUMN IF EXISTS "higgsfieldJobId";

-- CreateTable VideoSegment
CREATE TABLE IF NOT EXISTS "VideoSegment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "hasCharacter" BOOLEAN NOT NULL DEFAULT false,
    "spokenPortion" TEXT,
    "visualDescription" TEXT,
    "videoUrl" TEXT,
    "duration" DOUBLE PRECISION,
    "status" "VideoSegmentStatus" NOT NULL DEFAULT 'pending',
    "higgsfieldJobId" TEXT,
    "errorMessage" TEXT,
    "generationStartedAt" TIMESTAMP(3),
    "generationCompletedAt" TIMESTAMP(3),
    "estimatedCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoSegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VideoSegment_postId_idx" ON "VideoSegment"("postId");
CREATE INDEX IF NOT EXISTS "VideoSegment_status_idx" ON "VideoSegment"("status");
CREATE INDEX IF NOT EXISTS "VideoSegment_postId_order_idx" ON "VideoSegment"("postId", "order");

DO $$ BEGIN
  ALTER TABLE "VideoSegment" ADD CONSTRAINT "VideoSegment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "VideoPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- VideoSettings: music (ElevenLabs) + captions (Captions.ai) + Plan/Approve/Execute defaults
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "musicEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "musicVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.3;
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "captionsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "captionsTemplateId" TEXT;
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "captionsTemplateName" TEXT DEFAULT 'Aries';
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "defaultTargetPlatform" "VideoTargetPlatform" NOT NULL DEFAULT 'auto';
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "defaultVideoStyle" "VideoStyle" NOT NULL DEFAULT 'auto';
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "defaultTargetShotCount" INTEGER;
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "defaultOrientation" TEXT NOT NULL DEFAULT '9:16';
