-- Human review gate between still generation and video generation.

ALTER TYPE "VideoPostStatus" ADD VALUE IF NOT EXISTS 'shooting_stills' BEFORE 'directing';
ALTER TYPE "VideoPostStatus" ADD VALUE IF NOT EXISTS 'stills_review' BEFORE 'directing';

ALTER TABLE "VideoSegment" ADD COLUMN IF NOT EXISTS "stillUrl" TEXT;
ALTER TABLE "VideoSegment" ADD COLUMN IF NOT EXISTS "stillJobId" TEXT;

ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "anchorStillUrl" TEXT;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "anchorStillJobId" TEXT;
