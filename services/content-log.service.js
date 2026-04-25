import { prisma } from '@/lib/prisma';

/**
 * Append a content-operation log (separate from SystemLog user activity).
 * @param {{ type: string; message: string; entityType?: string | null; entityId?: string | null }} data
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function contentLog(data, tx) {
  const connection = tx ?? prisma;
  await connection.contentLog.create({
    data: {
      type: data.type,
      message: data.message,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
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
