import { prisma } from '@/lib/prisma';

/**
 * @typedef {'planning' | 'research' | 'writing' | 'image_generation'} AIAttemptType
 * @typedef {'success' | 'failed'} AIAttemptStatus
 */

/**
 * Log an AI attempt (n8n call, redo, or any generation step).
 *
 * @param {{
 *   type: AIAttemptType;
 *   articleId?: string | null;
 *   slotId?: string | null;
 *   prompt?: string | null;
 *   result?: string | null;
 *   model: string;
 *   status?: AIAttemptStatus;
 *   isRedo?: boolean;
 *   triggeredBy?: string | null;
 * }} data
 */
export async function createAttempt(data) {
  return prisma.aIAttempt.create({
    data: {
      type: data.type,
      articleId: data.articleId?.trim() || null,
      slotId: data.slotId?.trim() || null,
      prompt: data.prompt ?? null,
      result: data.result ?? null,
      model: data.model,
      status: data.status === 'failed' ? 'failed' : 'success',
      isRedo: data.isRedo ?? false,
      triggeredBy: data.triggeredBy ?? null,
    },
  });
}

/**
 * List attempts, optionally scoped to an article or slot.
 *
 * @param {{ articleId?: string | null; slotId?: string | null; type?: AIAttemptType }} [filters]
 */
export async function getAttempts(filters = {}) {
  const where = {};
  if (filters.articleId) where.articleId = filters.articleId;
  if (filters.slotId) where.slotId = filters.slotId;
  if (filters.type) where.type = filters.type;

  return prisma.aIAttempt.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}
