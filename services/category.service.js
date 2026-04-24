import { prisma } from '@/lib/prisma';

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { topics: true, articles: true },
      },
    },
  });
}

/**
 * @param {string} id
 */
export async function getCategoryById(id) {
  return prisma.category.findUnique({
    where: { id },
    include: {
      topics: { orderBy: { name: 'asc' } },
      _count: { select: { topics: true, articles: true } },
    },
  });
}
