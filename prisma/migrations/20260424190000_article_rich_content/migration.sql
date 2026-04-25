-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "summary" TEXT;
ALTER TABLE "Article" ADD COLUMN     "content" JSONB;
ALTER TABLE "Article" ADD COLUMN     "featuredImage" TEXT;
ALTER TABLE "Article" ADD COLUMN     "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Article" ADD COLUMN     "videoUrl" TEXT;
ALTER TABLE "Article" ADD COLUMN     "isEditorsChoice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Article" ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN     "likes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN     "commentsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Article_isEditorsChoice_idx" ON "Article"("isEditorsChoice");
