import { prisma } from '@/lib/prisma';
import { contentLog } from '@/services/content-log.service';

function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeTitle(value) {
  const title = normalizeText(value);
  if (!title) {
    const error = new Error('Title is required');
    error.code = 'VALIDATION';
    throw error;
  }
  return title;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((tag) => String(tag || '').trim()).filter(Boolean))];
}

async function requireIdea(id, tx = prisma) {
  const idea = await tx.ideaBacklog.findUnique({ where: { id } });
  if (!idea) {
    const error = new Error('Idea not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  return idea;
}

export async function getIdeas(filters = {}) {
  const where = {};
  if (filters.status && filters.status !== 'all') where.status = filters.status;
  if (filters.priority && filters.priority !== 'all') where.priority = filters.priority;

  return prisma.ideaBacklog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function createIdea(data) {
  const title = normalizeTitle(data.title);
  const description = normalizeText(data.description);
  const tags = normalizeTags(data.tags);

  return prisma.$transaction(async (tx) => {
    const idea = await tx.ideaBacklog.create({
      data: {
        title,
        description,
        priority: data.priority || 'medium',
        status: data.status || 'new',
        tags,
      },
    });
    await contentLog(
      {
        type: 'project',
        action: 'create',
        message: `Idea backlog item “${idea.title}” created`,
        entityType: 'idea_backlog',
        entityId: idea.id,
      },
      tx,
    );
    return idea;
  });
}

export async function updateIdea(id, data) {
  await requireIdea(id);
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(data, 'title')) {
    patch.title = normalizeTitle(data.title);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'description')) {
    patch.description = normalizeText(data.description);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'priority')) {
    patch.priority = data.priority;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'status')) {
    patch.status = data.status;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'tags')) {
    patch.tags = normalizeTags(data.tags);
  }

  return prisma.$transaction(async (tx) => {
    const idea = await tx.ideaBacklog.update({
      where: { id },
      data: patch,
    });
    await contentLog(
      {
        type: 'project',
        action: 'update',
        message: `Idea backlog item “${idea.title}” updated`,
        entityType: 'idea_backlog',
        entityId: idea.id,
      },
      tx,
    );
    return idea;
  });
}

export async function deleteIdea(id) {
  const existing = await requireIdea(id);
  return prisma.$transaction(async (tx) => {
    await tx.ideaBacklog.delete({ where: { id } });
    await contentLog(
      {
        type: 'project',
        action: 'delete',
        message: `Idea backlog item “${existing.title}” deleted`,
        entityType: 'idea_backlog',
        entityId: id,
      },
      tx,
    );
    return { deleted: true, id };
  });
}
