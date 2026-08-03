-- nano_banana_2 defaults to 1k, which renders on-frame text as mush that
-- Seedance then animates into gibberish. 2k is the new floor.

ALTER TABLE "VideoSettings" ADD COLUMN IF NOT EXISTS "stillResolution" TEXT NOT NULL DEFAULT '2k';
