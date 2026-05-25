import { prisma } from '@/lib/prisma';
import { contentLog } from '@/services/content-log.service';

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
      _count: { select: { articles: true } },
    },
  });
}

/**
 * @param {string} name
 * @param {string} categoryId
 * @param {string} [excludeId]
 */
async function findDuplicateTopicNameInCategory(name, categoryId, excludeId) {
  return prisma.topic.findFirst({
    where: {
      categoryId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

/**
 * @param {{ name: string; description?: string | null; categoryId: string; targetKeyword?: string | null; status: 'active' | 'archived' }} data
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function createTopic(data, opts = {}) {
  const trimmed = data.name?.trim();
  if (!trimmed) {
    const err = new Error('Name is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!data.categoryId?.trim()) {
    const err = new Error('Category is required');
    err.code = 'VALIDATION';
    throw err;
  }
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) {
    const err = new Error('Category not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const dupe = await findDuplicateTopicNameInCategory(
    trimmed,
    data.categoryId,
  );
  if (dupe) {
    const err = new Error('A topic with this name already exists in this category');
    err.code = 'DUPLICATE';
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.topic.create({
      data: {
        name: trimmed,
        description: data.description?.trim() || null,
        categoryId: data.categoryId,
        targetKeyword: data.targetKeyword?.trim() || null,
        status: data.status,
      },
      include: {
        category: { select: { name: true } },
        _count: { select: { articles: true } },
      },
    });
    await contentLog(
      {
        type: 'topic',
        action: 'create',
        message: `Topic “${row.name}” created`,
        entityType: 'topic',
        entityId: row.id,
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    return row;
  });
}

/**
 * @param {string} id
 * @param {{ name: string; description?: string | null; categoryId: string; targetKeyword?: string | null; status: 'active' | 'archived' }} data
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function updateTopic(id, data, opts = {}) {
  const existing = await prisma.topic.findUnique({ where: { id } });
  if (!existing) {
    const err = new Error('Topic not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const trimmed = data.name?.trim();
  if (!trimmed) {
    const err = new Error('Name is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!data.categoryId?.trim()) {
    const err = new Error('Category is required');
    err.code = 'VALIDATION';
    throw err;
  }
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) {
    const err = new Error('Category not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const dupe = await findDuplicateTopicNameInCategory(
    trimmed,
    data.categoryId,
    id,
  );
  if (dupe) {
    const err = new Error('A topic with this name already exists in this category');
    err.code = 'DUPLICATE';
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.topic.update({
      where: { id },
      data: {
        name: trimmed,
        description: data.description?.trim() || null,
        categoryId: data.categoryId,
        targetKeyword: data.targetKeyword?.trim() || null,
        status: data.status,
      },
      include: {
        category: { select: { name: true } },
        _count: { select: { articles: true } },
      },
    });
    await contentLog(
      {
        type: 'topic',
        action: 'update',
        message: `Topic “${row.name}” updated`,
        entityType: 'topic',
        entityId: row.id,
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    return row;
  });
}

/**
 * Archives when the topic has articles; otherwise hard-deletes.
 * @param {string} id
 * @param {{ createdBy?: string | null }} [opts]
 * @returns {Promise<{ result: 'archived' | 'deleted'; id: string; alreadyArchived?: boolean }>}
 */
export async function archiveOrDeleteTopic(id, opts = {}) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.topic.findUnique({
      where: { id },
      include: { _count: { select: { articles: true } } },
    });
    if (!row) {
      const err = new Error('Topic not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (row._count.articles > 0) {
      if (row.status === 'archived') {
        return { result: 'archived', id: row.id, alreadyArchived: true };
      }
      await tx.topic.update({
        where: { id },
        data: { status: 'archived' },
      });
      await contentLog(
        {
          type: 'topic',
          action: 'archive',
          message: `Topic “${row.name}” archived (has related articles)`,
          entityType: 'topic',
          entityId: id,
          createdBy: opts.createdBy ?? null,
        },
        tx,
      );
      return { result: 'archived', id: row.id, alreadyArchived: false };
    }
    await contentLog(
      {
        type: 'topic',
        action: 'delete',
        message: `Topic “${row.name}” deleted`,
        entityType: 'topic',
        entityId: id,
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    await tx.topic.delete({ where: { id } });
    return { result: 'deleted', id: row.id, alreadyArchived: false };
  });
}
