import { prisma } from '@/lib/prisma';
import { contentLog } from '@/services/content-log.service';

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      section: { select: { id: true, name: true, slug: true } },
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
      section: { select: { id: true, name: true, slug: true } },
      topics: { orderBy: { name: 'asc' } },
      _count: { select: { topics: true, articles: true } },
    },
  });
}

/**
 * @param {string} name
 * @param {string} [excludeId]
 */
async function findDuplicateCategoryName(name, excludeId) {
  return prisma.category.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

/**
 * @param {{
 *   name: string;
 *   description?: string | null;
 *   status: 'active' | 'archived';
 *   sectionId?: string | null;
 * }} data
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function createCategory(data, opts = {}) {
  const trimmed = data.name?.trim();
  if (!trimmed) {
    const err = new Error('Name is required');
    err.code = 'VALIDATION';
    throw err;
  }
  const dupe = await findDuplicateCategoryName(trimmed);
  if (dupe) {
    const err = new Error('A category with this name already exists');
    err.code = 'DUPLICATE';
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.category.create({
      data: {
        name: trimmed,
        description: data.description?.trim() || null,
        status: data.status,
        sectionId: data.sectionId || null,
      },
    });
    await contentLog(
      {
        type: 'category',
        action: 'create',
        message: `Category "${row.name}" created`,
        entityType: 'category',
        entityId: row.id,
        metadata: data.sectionId ? { sectionId: data.sectionId } : null,
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    return row;
  });
}

/**
 * @param {string} id
 * @param {{
 *   name: string;
 *   description?: string | null;
 *   status: 'active' | 'archived';
 *   sectionId?: string | null;
 * }} data
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function updateCategory(id, data, opts = {}) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    const err = new Error('Category not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const trimmed = data.name?.trim();
  if (!trimmed) {
    const err = new Error('Name is required');
    err.code = 'VALIDATION';
    throw err;
  }
  const dupe = await findDuplicateCategoryName(trimmed, id);
  if (dupe) {
    const err = new Error('A category with this name already exists');
    err.code = 'DUPLICATE';
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.category.update({
      where: { id },
      data: {
        name: trimmed,
        description: data.description?.trim() || null,
        status: data.status,
        sectionId: data.sectionId !== undefined ? (data.sectionId || null) : existing.sectionId,
      },
    });
    await contentLog(
      {
        type: 'category',
        action: 'update',
        message: `Category "${row.name}" updated`,
        entityType: 'category',
        entityId: row.id,
        metadata: { sectionId: row.sectionId },
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    return row;
  });
}

/**
 * Archives when the category has topics or articles; otherwise hard-deletes.
 * @param {string} id
 * @param {{ createdBy?: string | null }} [opts]
 * @returns {Promise<{ result: 'archived' | 'deleted'; id: string; alreadyArchived?: boolean }>}
 */
export async function archiveOrDeleteCategory(id, opts = {}) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.category.findUnique({
      where: { id },
      include: { _count: { select: { topics: true, articles: true } } },
    });
    if (!row) {
      const err = new Error('Category not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
    const hasDeps =
      row._count.topics > 0 || row._count.articles > 0;
    if (hasDeps) {
      if (row.status === 'archived') {
        return { result: 'archived', id: row.id, alreadyArchived: true };
      }
      await tx.category.update({
        where: { id },
        data: { status: 'archived' },
      });
      await contentLog(
        {
          type: 'category',
          action: 'archive',
          message: `Category "${row.name}" archived (has related topics or articles)`,
          entityType: 'category',
          entityId: id,
          createdBy: opts.createdBy ?? null,
        },
        tx,
      );
      return { result: 'archived', id: row.id, alreadyArchived: false };
    }
    await contentLog(
      {
        type: 'category',
        action: 'delete',
        message: `Category "${row.name}" deleted`,
        entityType: 'category',
        entityId: id,
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    await tx.category.delete({ where: { id } });
    return { result: 'deleted', id: row.id, alreadyArchived: false };
  });
}
