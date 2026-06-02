-- AIAttempt: add type, slotId, isRedo, triggeredBy; make prompt/result nullable

-- ============================================================
-- Step 1: Create AIAttemptType enum
-- ============================================================
CREATE TYPE "AIAttemptType" AS ENUM (
  'planning',
  'research',
  'writing',
  'image_generation'
);

-- ============================================================
-- Step 2: Add new columns
-- ============================================================
ALTER TABLE "AIAttempt"
  ADD COLUMN IF NOT EXISTS "type"        "AIAttemptType" NOT NULL DEFAULT 'research',
  ADD COLUMN IF NOT EXISTS "slotId"      TEXT,
  ADD COLUMN IF NOT EXISTS "isRedo"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "triggeredBy" TEXT;

-- ============================================================
-- Step 3: Make prompt and result nullable
-- ============================================================
ALTER TABLE "AIAttempt"
  ALTER COLUMN "prompt" DROP NOT NULL,
  ALTER COLUMN "result" DROP NOT NULL;

-- ============================================================
-- Step 4: Remove default from type (was only needed for existing rows)
-- ============================================================
ALTER TABLE "AIAttempt" ALTER COLUMN "type" DROP DEFAULT;

-- ============================================================
-- Step 5: Add indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS "AIAttempt_slotId_idx"  ON "AIAttempt"("slotId");
CREATE INDEX IF NOT EXISTS "AIAttempt_type_idx"    ON "AIAttempt"("type");
