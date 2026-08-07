-- Places and subjects become named anchors the planner declares once and
-- segments point at, each with its own reviewable start frame.
--
-- Until now only the character had both a description and an anchor image;
-- everything else had text alone, and text loses against an image reference —
-- which is why one closet came back as five different closets, and why the
-- character could never leave the environment her anchor was shot in.

CREATE TYPE "VideoAnchorKind" AS ENUM ('place', 'subject');

CREATE TABLE "VideoAnchor" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "VideoAnchorKind" NOT NULL DEFAULT 'place',
    "description" TEXT NOT NULL,
    "stillUrl" TEXT,
    "stillJobId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnchor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoAnchor_postId_key_key" ON "VideoAnchor"("postId", "key");
CREATE INDEX "VideoAnchor_postId_idx" ON "VideoAnchor"("postId");

ALTER TABLE "VideoAnchor" ADD CONSTRAINT "VideoAnchor_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "VideoPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoSegment" ADD COLUMN IF NOT EXISTS "anchorKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "VideoSegment" ADD COLUMN IF NOT EXISTS "wardrobeAddition" TEXT;

-- Carry existing single-subject posts over, so a post planned before this
-- keeps its closet description instead of silently losing it.
INSERT INTO "VideoAnchor" ("id", "postId", "key", "kind", "description", "order", "updatedAt")
SELECT gen_random_uuid(), "id", 'subject', 'subject', "subjectAnchor", 0, CURRENT_TIMESTAMP
FROM "VideoPost"
WHERE "subjectAnchor" IS NOT NULL AND btrim("subjectAnchor") <> '';
