-- Video/social exclusivity, manual day-by-day article selection, a
-- standalone character roster, and fully custom (article-less,
-- campaign-less) videos.

-- New enum: which path a campaign's articles came from
DO $$ BEGIN
  CREATE TYPE "VideoCampaignSelectionMode" AS ENUM ('agent', 'manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "VideoCampaign" ADD COLUMN IF NOT EXISTS "selectionMode" "VideoCampaignSelectionMode" NOT NULL DEFAULT 'agent';

-- New standalone character roster — additive to Section.videoCharacterId,
-- used by custom videos that aren't derived from an article/section at all.
CREATE TABLE IF NOT EXISTS "VideoCharacter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "persona" TEXT,
    "tone" TEXT,
    "videoCharacterId" TEXT,
    "referenceImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoCharacter_pkey" PRIMARY KEY ("id")
);

-- VideoPost: campaignId/articleId become optional so a custom video can
-- stand entirely on its own; add the custom-content fields.
ALTER TABLE "VideoPost" ALTER COLUMN "campaignId" DROP NOT NULL;
ALTER TABLE "VideoPost" ALTER COLUMN "articleId" DROP NOT NULL;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "customTitle" TEXT;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "customContent" TEXT;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "customCharacterId" TEXT;

DO $$ BEGIN
  ALTER TABLE "VideoPost" ADD CONSTRAINT "VideoPost_customCharacterId_fkey" FOREIGN KEY ("customCharacterId") REFERENCES "VideoCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- VideoCampaignLog: campaignId becomes optional so a campaign-less custom
-- video's activity can still be logged (postId alone identifies it).
ALTER TABLE "VideoCampaignLog" ALTER COLUMN "campaignId" DROP NOT NULL;
