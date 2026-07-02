-- Add new Buffer channel ID fields (GraphQL API uses "channels" not "profiles")
ALTER TABLE "SocialSettings"
  ADD COLUMN IF NOT EXISTS "instagramChannelId" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedinChannelId"  TEXT,
  ADD COLUMN IF NOT EXISTS "twitterChannelId"   TEXT;
