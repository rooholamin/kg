-- A segment's start frame gets its own description, separate from the motion.
--
-- visualDescription was driving both the image call and the video call, but it
-- is written as what happens across the clip. Handed to an image model, a list
-- of actions comes back as a multi-panel collage (shipped: a start frame that
-- was four photographs in a grid), and two simultaneous actions come back as
-- one frame with an extra arm in it.

ALTER TABLE "VideoSegment" ADD COLUMN IF NOT EXISTS "startFrame" TEXT;
