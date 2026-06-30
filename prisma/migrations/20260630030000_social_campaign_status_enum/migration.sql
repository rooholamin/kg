ALTER TYPE "SocialCampaignStatus" ADD VALUE IF NOT EXISTS 'content_generating';
ALTER TYPE "SocialCampaignStatus" ADD VALUE IF NOT EXISTS 'exporting';
ALTER TYPE "SocialCampaignStatus" ADD VALUE IF NOT EXISTS 'scheduling';
ALTER TYPE "SocialCampaignStatus" ADD VALUE IF NOT EXISTS 'cancelled';
