-- Separate the article publishDate filter from the posting/schedule window.
-- Null means "use weekStart/weekEnd" (preserves existing campaign behavior).
ALTER TABLE "SocialCampaign"
  ADD COLUMN IF NOT EXISTS "articleDateStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "articleDateEnd" TIMESTAMP(3);
