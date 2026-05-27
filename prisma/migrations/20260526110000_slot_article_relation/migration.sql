-- AddForeignKey: ScheduledArticleSlot.articleId → Article.id
ALTER TABLE "ScheduledArticleSlot"
  ADD CONSTRAINT "ScheduledArticleSlot_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ScheduledArticleSlot_articleId_idx" ON "ScheduledArticleSlot"("articleId");
