-- Add socialHashtags to Section
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "socialHashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Create enums
CREATE TYPE "SocialCampaignStatus" AS ENUM ('pending', 'running', 'reviewing', 'done', 'failed');
CREATE TYPE "SocialPlatform" AS ENUM ('instagram_carousel', 'instagram_story', 'linkedin', 'twitter');
CREATE TYPE "SocialPostStatus" AS ENUM ('pending', 'content_generating', 'content_ready', 'exporting', 'uploaded', 'scheduling', 'scheduled', 'failed');

-- CreateTable SocialSettings
CREATE TABLE "SocialSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "approvalAgentId" TEXT,
    "approvalEnvironmentId" TEXT,
    "contentAgentId" TEXT,
    "contentEnvironmentId" TEXT,
    "instagramCarouselProfileId" TEXT,
    "instagramStoryProfileId" TEXT,
    "linkedinProfileId" TEXT,
    "twitterProfileId" TEXT,
    "defaultMaxInstagramCarousel" INTEGER NOT NULL DEFAULT 3,
    "defaultMaxInstagramStory" INTEGER NOT NULL DEFAULT 5,
    "defaultMaxLinkedin" INTEGER NOT NULL DEFAULT 3,
    "defaultMaxTwitter" INTEGER NOT NULL DEFAULT 7,
    "instagramPostTime" TEXT NOT NULL DEFAULT '09:00',
    "instagramPostDays" INTEGER NOT NULL DEFAULT 62,
    "linkedinPostTime" TEXT NOT NULL DEFAULT '08:00',
    "linkedinPostDays" INTEGER NOT NULL DEFAULT 40,
    "twitterPostTime" TEXT NOT NULL DEFAULT '10:00',
    "twitterPostDays" INTEGER NOT NULL DEFAULT 62,
    "lookbackDays" INTEGER NOT NULL DEFAULT 30,
    "requireReview" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable SocialAiMemory
CREATE TABLE "SocialAiMemory" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "activeSessionId" TEXT,
    "sessionCampaignCount" INTEGER NOT NULL DEFAULT 0,
    "sessionRotateAfter" INTEGER NOT NULL DEFAULT 10,
    "handoffSummary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAiMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable SocialCampaign
CREATE TABLE "SocialCampaign" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "SocialCampaignStatus" NOT NULL DEFAULT 'pending',
    "maxPostsPerPlatform" JSONB NOT NULL,
    "campaignBrief" TEXT,
    "editorsChoiceOnly" BOOLEAN NOT NULL DEFAULT false,
    "includeSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvalSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable SocialPost
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'pending',
    "slideIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedText" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "placeholders" JSONB,
    "exportProgress" INTEGER NOT NULL DEFAULT 0,
    "exportTotal" INTEGER NOT NULL DEFAULT 0,
    "bufferPostId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "analyticsData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialCampaign_status_idx" ON "SocialCampaign"("status");
CREATE INDEX "SocialCampaign_weekStart_idx" ON "SocialCampaign"("weekStart");
CREATE INDEX "SocialPost_campaignId_idx" ON "SocialPost"("campaignId");
CREATE INDEX "SocialPost_articleId_idx" ON "SocialPost"("articleId");
CREATE INDEX "SocialPost_platform_idx" ON "SocialPost"("platform");
CREATE INDEX "SocialPost_status_idx" ON "SocialPost"("status");

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
