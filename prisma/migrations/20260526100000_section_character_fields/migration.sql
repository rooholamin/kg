-- AlterTable
ALTER TABLE "Section" ADD COLUMN "characterBackground" TEXT,
ADD COLUMN "characterRole" TEXT,
ADD COLUMN "characterAge" TEXT,
ADD COLUMN "characterTone" TEXT,
ADD COLUMN "characterWritingStyle" TEXT,
ADD COLUMN "characterSampleVoice" TEXT;

-- AlterTable: change existing columns to TEXT for longer prompts
ALTER TABLE "Section"
  ALTER COLUMN "characterBiography" TYPE TEXT,
  ALTER COLUMN "characterPersona" TYPE TEXT;
