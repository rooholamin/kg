import { prisma } from '@/lib/prisma';

/**
 * Top-level stats for the /dashboard/seo page. Mirrors the shape the mock
 * data (DASHBOARD_STATS / MOCK_SEO_ARTICLES) used to fake, but real.
 */
export async function getSeoDashboardStats() {
  const [
    seoOptimizedCount,
    seoPendingCount,
    seoFailedCount,
    linkedCount,
    batchesRun,
    batchesWithLink,
  ] = await Promise.all([
    prisma.article.count({ where: { seoOptimized: true } }),
    prisma.article.count({ where: { status: 'post_publish', seoOptimized: false } }),
    prisma.seoOptimizationRun.count({ where: { status: 'failed' } }),
    prisma.article.count({ where: { kingsgateLinkUrl: { not: null } } }),
    prisma.kingsgateLinkingBatchRun.count({ where: { status: { in: ['completed', 'failed'] } } }),
    prisma.kingsgateLinkingBatchRun.count({ where: { selectedArticleId: { not: null } } }),
  ]);

  const linkRatePercent = batchesRun > 0 ? Math.round((batchesWithLink / batchesRun) * 1000) / 10 : null;

  return {
    seoOptimizedCount,
    seoPendingCount,
    seoFailedCount,
    linkedCount,
    batchesRun,
    batchesWithLink,
    linkRatePercent,
  };
}

/**
 * Per-article SEO status for the dashboard table — every article that's
 * reached post_publish, newest first.
 */
export async function getSeoArticlesPage({ page = 1, pageSize = 25 } = {}) {
  const where = { status: { in: ['post_publish'] } };
  const size = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const pageNum = Math.max(Number(page) || 1, 1);

  const [total, rows] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (pageNum - 1) * size,
      take: size,
      select: {
        id: true,
        title: true,
        seoScore: true,
        seoKeywords: true,
        seoOptimized: true,
        seoOptimizedAt: true,
        linkReviewed: true,
        kingsgateLinkUrl: true,
        topic: { select: { targetKeyword: true } },
      },
    }),
  ]);

  return { rows, total, page: pageNum, pageSize: size };
}

/** Recent on-page SEO runs, newest first, joined with the article title. */
export async function getRecentSeoRuns(take = 30) {
  return prisma.seoOptimizationRun.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: { article: { select: { id: true, title: true } } },
  });
}

/** Recent linking batch runs, newest first. */
export async function getRecentLinkingBatchRuns(take = 30) {
  const runs = await prisma.kingsgateLinkingBatchRun.findMany({
    orderBy: { createdAt: 'desc' },
    take,
  });

  // Resolve article titles for the batch member ids + the winner, in one query.
  const allIds = [...new Set(runs.flatMap((r) => r.articleIds))];
  const articles = allIds.length
    ? await prisma.article.findMany({ where: { id: { in: allIds } }, select: { id: true, title: true } })
    : [];
  const titleById = Object.fromEntries(articles.map((a) => [a.id, a.title]));

  return runs.map((r) => ({
    ...r,
    articleTitles: r.articleIds.map((id) => titleById[id] ?? id),
    selectedArticleTitle: r.selectedArticleId ? (titleById[r.selectedArticleId] ?? r.selectedArticleId) : null,
  }));
}

/** Most recent on-page SEO run for a single article (article detail page). */
export async function getArticleSeoOptimizationRun(articleId) {
  return prisma.seoOptimizationRun.findFirst({
    where: { articleId },
    orderBy: { createdAt: 'desc' },
  });
}

/** Most recent linking batch this article was considered in (article detail page). */
export async function getArticleKingsgateLinkingBatchRun(articleId) {
  return prisma.kingsgateLinkingBatchRun.findFirst({
    where: { articleIds: { has: articleId } },
    orderBy: { createdAt: 'desc' },
  });
}
