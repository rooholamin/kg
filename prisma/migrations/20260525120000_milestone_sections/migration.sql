-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('active', 'archived');

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "summary" TEXT,
    "icon" TEXT,
    "status" "SectionStatus" NOT NULL DEFAULT 'active',
    "characterName" TEXT,
    "characterBiography" TEXT,
    "characterPersona" TEXT,
    "characterImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Section_slug_key" ON "Section"("slug");

-- CreateIndex
CREATE INDEX "Section_status_idx" ON "Section"("status");

-- CreateIndex
CREATE INDEX "Section_slug_idx" ON "Section"("slug");

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "sectionId" TEXT;

-- CreateIndex
CREATE INDEX "Category_sectionId_idx" ON "Category"("sectionId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
