import { prisma } from '@/lib/prisma';

/**
 * @param {{ categoryId?: string | null; status?: string | null }} [filters]
 */
export async function getTopics(filters = {}) {
  const { categoryId, status } = filters;

  const where = {
    ...(categoryId ? { categoryId } : {}),
    ...(status && status !== 'all' ? { status } : {}),
  };

  return prisma.topic.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { articles: true } },
    },
  });
}

/**
 * @param {string} id
 */
export async function getTopicById(id) {
  return prisma.topic.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      articles: { orderBy: { updatedAt: 'desc' } },
    },
  });
}
