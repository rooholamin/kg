-- AlterTable: per-slide HERO_IMAGE assignments chosen by the content agent
ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "slideImages" JSONB;
