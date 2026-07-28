-- Section: video avatar fields (Higgsfield Soul Character trained from characterImage)
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "videoCharacterId" TEXT;
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "videoRefImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "videoOutfitDescription" TEXT;

-- Create enums
CREATE TYPE "VideoCampaignStatus" AS ENUM ('pending', 'running', 'approving', 'directing', 'exporting', 'reviewing', 'scheduling', 'paused', 'done', 'failed', 'cancelled');
CREATE TYPE "VideoPostStatus" AS ENUM ('pending', 'directing', 'content_ready', 'exporting', 'uploaded', 'scheduling', 'scheduled', 'failed');
CREATE TYPE "VideoFailureType" AS ENUM ('nsfw', 'ip_detected', 'quality', 'timeout');

-- CreateTable VideoEnvironment (singleton)
CREATE TABLE "VideoEnvironment" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL DEFAULT 'KG Media Loft',
    "textDescriptor" TEXT,
    "refImageUrl" TEXT,
    "higgsfieldRefId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoCampaign
CREATE TABLE "VideoCampaign" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "VideoCampaignStatus" NOT NULL DEFAULT 'pending',
    "articleDateStart" TIMESTAMP(3),
    "articleDateEnd" TIMESTAMP(3),
    "campaignBrief" TEXT,
    "editorsChoiceOnly" BOOLEAN NOT NULL DEFAULT false,
    "includeSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxVideos" INTEGER,
    "approvalSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoPost
CREATE TABLE "VideoPost" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "status" "VideoPostStatus" NOT NULL DEFAULT 'pending',
    "directorSessionId" TEXT,
    "directorNote" TEXT,
    "shotList" JSONB,
    "generatedText" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stillAssetUrl" TEXT,
    "videoUrl" TEXT,
    "duration" INTEGER,
    "aspectRatio" TEXT,
    "genre" TEXT,
    "higgsfieldJobId" TEXT,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bufferPostIds" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "analyticsData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoCampaignLog
CREATE TABLE "VideoCampaignLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "postId" TEXT,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "message" TEXT,
    "input" JSONB,
    "output" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoCampaignLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoSettings (singleton)
CREATE TABLE "VideoSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "approvalAgentId" TEXT,
    "approvalEnvironmentId" TEXT,
    "directorAgentId" TEXT,
    "directorEnvironmentId" TEXT,
    "defaultMaxVideosPerCampaign" INTEGER NOT NULL DEFAULT 5,
    "defaultDuration" INTEGER NOT NULL DEFAULT 15,
    "defaultAspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "defaultGenre" TEXT NOT NULL DEFAULT 'auto',
    "defaultPlatforms" TEXT[] NOT NULL DEFAULT ARRAY['instagram_carousel', 'linkedin', 'twitter']::TEXT[],
    "maxGenerationsPerPost" INTEGER NOT NULL DEFAULT 4,
    "requireReview" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoAiMemory (singleton)
CREATE TABLE "VideoAiMemory" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "activeSessionId" TEXT,
    "sessionCampaignCount" INTEGER NOT NULL DEFAULT 0,
    "sessionRotateAfter" INTEGER NOT NULL DEFAULT 10,
    "handoffSummary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoAiMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable VideoPromptLearning
CREATE TABLE "VideoPromptLearning" (
    "id" TEXT NOT NULL,
    "triggerPhrase" TEXT NOT NULL,
    "failureType" "VideoFailureType" NOT NULL,
    "safeRewrite" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoPromptLearning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoCampaign_status_idx" ON "VideoCampaign"("status");
CREATE INDEX "VideoCampaign_weekStart_idx" ON "VideoCampaign"("weekStart");
CREATE INDEX "VideoPost_campaignId_idx" ON "VideoPost"("campaignId");
CREATE INDEX "VideoPost_articleId_idx" ON "VideoPost"("articleId");
CREATE INDEX "VideoPost_status_idx" ON "VideoPost"("status");
CREATE INDEX "VideoCampaignLog_campaignId_idx" ON "VideoCampaignLog"("campaignId");
CREATE INDEX "VideoCampaignLog_postId_idx" ON "VideoCampaignLog"("postId");
CREATE INDEX "VideoCampaignLog_step_idx" ON "VideoCampaignLog"("step");
CREATE INDEX "VideoPromptLearning_failureType_idx" ON "VideoPromptLearning"("failureType");

-- AddForeignKey
ALTER TABLE "VideoPost" ADD CONSTRAINT "VideoPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "VideoCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoPost" ADD CONSTRAINT "VideoPost_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoCampaignLog" ADD CONSTRAINT "VideoCampaignLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "VideoCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
