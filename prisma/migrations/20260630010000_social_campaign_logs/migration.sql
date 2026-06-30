-- CreateTable: pipeline run log for live campaign tracing
CREATE TABLE "SocialCampaignLog" (
  "id"         TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "postId"     TEXT,
  "step"       TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'running',
  "message"    TEXT,
  "input"      JSONB,
  "output"     JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SocialCampaignLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialCampaignLog_campaignId_idx" ON "SocialCampaignLog"("campaignId");
CREATE INDEX "SocialCampaignLog_postId_idx" ON "SocialCampaignLog"("postId");
CREATE INDEX "SocialCampaignLog_step_idx" ON "SocialCampaignLog"("step");

ALTER TABLE "SocialCampaignLog"
  ADD CONSTRAINT "SocialCampaignLog_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
