-- Splits the video director agent in two: a tool-less Planner Agent for
-- Phase 1 (can never spend a real generation credit) and the existing
-- Director Agent for Phase 3 execute + segment regeneration. A session is
-- pinned to one specific agent for its whole lifetime, so these need
-- separate session ids even though they cooperate on the same video.
ALTER TABLE "VideoPost" ADD COLUMN IF NOT EXISTS "planSessionId" TEXT;

ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "plannerAgentId" TEXT;
ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "plannerEnvironmentId" TEXT;
