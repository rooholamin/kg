-- Add position column to ScheduledArticleSlot for deterministic intra-day ordering
ALTER TABLE "ScheduledArticleSlot" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
