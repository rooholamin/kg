import { prisma } from '@/lib/prisma';
import { contentLog } from '@/services/content-log.service';

/**
 * Auto-generate a URL-friendly slug from a string.
 * @param {string} value
 * @returns {string}
 */
function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function getSections() {
  return prisma.section.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { categories: true } },
    },
  });
}

/**
 * @param {string} id
 */
export async function getSectionById(id) {
  return prisma.section.findUnique({
    where: { id },
    include: {
      categories: {
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { topics: true, articles: true } },
        },
      },
      _count: { select: { categories: true } },
    },
  });
}

/**
 * @param {string} slug
 * @param {string} [excludeId]
 */
async function findDuplicateSlug(slug, excludeId) {
  return prisma.section.findFirst({
    where: {
      slug: { equals: slug, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

/**
 * @param {{
 *   name: string;
 *   slug?: string | null;
 *   description?: string | null;
 *   summary?: string | null;
 *   icon?: string | null;
 *   status: 'active' | 'archived';
 *   characterName?: string | null;
 *   characterBiography?: string | null;
 *   characterPersona?: string | null;
 *   characterImage?: string | null;
 * }} data
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function createSection(data, opts = {}) {
  const trimmedName = data.name?.trim();
  if (!trimmedName) {
    const err = new Error('Name is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const slug = data.slug?.trim() ? slugify(data.slug.trim()) : slugify(trimmedName);

  const dupe = await findDuplicateSlug(slug);
  if (dupe) {
    const err = new Error('A section with this slug already exists');
    err.code = 'DUPLICATE';
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.section.create({
      data: {
        name: trimmedName,
        slug,
        description: data.description?.trim() || null,
        summary: data.summary?.trim() || null,
        icon: data.icon?.trim() || null,
        status: data.status,
        characterName: data.characterName?.trim() || null,
        characterBiography: data.characterBiography?.trim() || null,
        characterPersona: data.characterPersona?.trim() || null,
        characterImage: data.characterImage?.trim() || null,
      },
    });
    await contentLog(
      {
        type: 'section',
        action: 'create',
        message: `Section "${row.name}" created`,
        entityType: 'section',
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
 * @param {{
 *   name: string;
 *   slug?: string | null;
 *   description?: string | null;
 *   summary?: string | null;
 *   icon?: string | null;
 *   status: 'active' | 'archived';
 *   characterName?: string | null;
 *   characterBiography?: string | null;
 *   characterPersona?: string | null;
 *   characterImage?: string | null;
 * }} data
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function updateSection(id, data, opts = {}) {
  const existing = await prisma.section.findUnique({ where: { id } });
  if (!existing) {
    const err = new Error('Section not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const trimmedName = data.name?.trim();
  if (!trimmedName) {
    const err = new Error('Name is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const slug = data.slug?.trim() ? slugify(data.slug.trim()) : slugify(trimmedName);

  const dupe = await findDuplicateSlug(slug, id);
  if (dupe) {
    const err = new Error('A section with this slug already exists');
    err.code = 'DUPLICATE';
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.section.update({
      where: { id },
      data: {
        name: trimmedName,
        slug,
        description: data.description?.trim() || null,
        summary: data.summary?.trim() || null,
        icon: data.icon?.trim() || null,
        status: data.status,
        characterName: data.characterName?.trim() || null,
        characterBiography: data.characterBiography?.trim() || null,
        characterPersona: data.characterPersona?.trim() || null,
        characterImage: data.characterImage?.trim() || null,
      },
    });
    await contentLog(
      {
        type: 'section',
        action: 'update',
        message: `Section "${row.name}" updated`,
        entityType: 'section',
        entityId: row.id,
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    return row;
  });
}

/**
 * Archives when the section has categories; otherwise hard-deletes.
 * @param {string} id
 * @param {{ createdBy?: string | null }} [opts]
 * @returns {Promise<{ result: 'archived' | 'deleted'; id: string; alreadyArchived?: boolean }>}
 */
export async function archiveOrDeleteSection(id, opts = {}) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.section.findUnique({
      where: { id },
      include: { _count: { select: { categories: true } } },
    });
    if (!row) {
      const err = new Error('Section not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const hasCategories = row._count.categories > 0;
    if (hasCategories) {
      if (row.status === 'archived') {
        return { result: 'archived', id: row.id, alreadyArchived: true };
      }
      await tx.section.update({
        where: { id },
        data: { status: 'archived' },
      });
      await contentLog(
        {
          type: 'section',
          action: 'archive',
          message: `Section "${row.name}" archived (has related categories)`,
          entityType: 'section',
          entityId: id,
          createdBy: opts.createdBy ?? null,
        },
        tx,
      );
      return { result: 'archived', id: row.id, alreadyArchived: false };
    }

    await contentLog(
      {
        type: 'section',
        action: 'delete',
        message: `Section "${row.name}" deleted`,
        entityType: 'section',
        entityId: id,
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    await tx.section.delete({ where: { id } });
    return { result: 'deleted', id: row.id, alreadyArchived: false };
  });
}
