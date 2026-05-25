import { prisma } from '@/lib/prisma';

/**
 * Append a content-operation log (separate from SystemLog user activity).
 * @param {{
 *   type: string;
 *   message: string;
 *   action?: string | null;
 *   entityType?: string | null;
 *   entityId?: string | null;
 *   metadata?: import('@prisma/client').Prisma.InputJsonValue | null;
 *   createdBy?: string | null;
 * }} data
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function contentLog(data, tx) {
  const connection = tx ?? prisma;
  await connection.contentLog.create({
    data: {
      type: data.type,
      action: data.action ?? null,
      message: data.message,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      metadata: data.metadata ?? undefined,
      createdBy: data.createdBy ?? null,
    },
  });
}

/**
 * Activity feed for a single content entity.
 * @param {string} entityType
 * @param {string} entityId
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function getContentLogsByEntity(entityType, entityId, tx) {
  const connection = tx ?? prisma;
  return connection.contentLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/** @alias getContentLogsByEntity */
export const getEntityLogs = getContentLogsByEntity;

/**
 * Global activity feed with optional filters.
 * @param {{
 *   type?: string | null;
 *   entityType?: string | null;
 *   entityId?: string | null;
 *   limit?: number;
 * }} [filters]
 */
export async function getLogs(filters = {}) {
  const { type, entityType, entityId, limit = 200 } = filters;
  const take = Math.min(Math.max(Number(limit) || 200, 1), 500);

  const where = {};
  if (type && type !== 'all') {
    where.type = type;
  }
  if (entityType && entityType !== 'all') {
    if (entityType === 'project') {
      where.type = 'project';
    } else {
      where.entityType = entityType;
    }
  }
  if (entityId?.trim()) {
    where.entityId = entityId.trim();
  }

  return prisma.contentLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  });
}
