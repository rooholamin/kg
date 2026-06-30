ALTER TABLE "SocialSettings"
  ADD COLUMN IF NOT EXISTS "disabledTemplates" TEXT[] NOT NULL DEFAULT '{}';
