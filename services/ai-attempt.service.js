import { prisma } from '@/lib/prisma';

/**
 * Store an AI generation attempt (used from Milestone 9).
 * @param {{
 *   articleId?: string | null;
 *   prompt: string;
 *   result: string;
 *   model: string;
 *   status?: 'success' | 'failed';
 * }} data
 */
export async function createAttempt(data) {
  const status = data.status === 'failed' ? 'failed' : 'success';
  return prisma.aIAttempt.create({
    data: {
      articleId: data.articleId?.trim() || null,
      prompt: data.prompt,
      result: data.result,
      model: data.model,
      status,
    },
  });
}

/**
 * List attempts, optionally scoped to an article.
 * @param {string | null | undefined} articleId
 */
export async function getAttempts(articleId) {
  return prisma.aIAttempt.findMany({
    where: articleId ? { articleId } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
