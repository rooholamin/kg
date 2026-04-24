import { prisma } from '@/lib/prisma';

/**
 * @param {{ topicId?: string | null; categoryId?: string | null; status?: string | null }} [filters]
 */
export async function getArticles(filters = {}) {
  const { topicId, categoryId, status } = filters;

  const where = {
    ...(topicId ? { topicId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(status && status !== 'all' ? { status } : {}),
  };

  return prisma.article.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      topic: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
}

/**
 * @param {string} id
 */
export async function getArticleById(id) {
  return prisma.article.findUnique({
    where: { id },
    include: {
      topic: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
}
