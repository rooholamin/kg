-- Per-post override of the global VideoEnvironment singleton, so a custom
-- video can be shot somewhere other than the KG Media Loft. Both columns null
-- (the default for every existing row) keeps the previous behavior.

ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "customEnvironmentName" TEXT;
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "customEnvironmentDescription" TEXT;
