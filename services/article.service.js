import { prisma } from '@/lib/prisma';
import {
  contentLog,
  getContentLogsByEntity,
} from '@/services/content-log.service';

const ARTICLE_STATUS = new Set([
  'planning',
  'research',
  'writing',
  'assets',
  'review',
  'approval',
  'scheduling',
  'publishing',
  'post_publish',
]);

const MS_PER_DAY = 86400000;

/** Pipeline stages treated as "ready" for the 7-day rule */
const READINESS_OK_STATUSES = new Set([
  'approval',
  'scheduling',
  'publishing',
  'post_publish',
]);

/**
 * @typedef {'ok' | 'warning' | 'risk' | null} ReadinessStatus
 */

/**
 * Derive readiness for calendar / enforcement (7-day rule).
 * @param {{
 *   status: string;
 *   readinessDeadline?: Date | string | null;
 *   publishDate?: Date | string | null;
 * }} article
 * @param {Date} [today] — defaults to now (for tests)
 * @returns {ReadinessStatus}
 */
export function computeReadiness(article, today = new Date()) {
  if (!article?.status) return null;
  if (READINESS_OK_STATUSES.has(article.status)) return 'ok';

  const raw = article.readinessDeadline;
  if (raw == null) return null;

  const deadline = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(deadline.getTime())) return null;

  const t0 = new Date(today);
  t0.setHours(0, 0, 0, 0);
  const d0 = new Date(deadline);
  d0.setHours(0, 0, 0, 0);

  if (t0.getTime() >= d0.getTime()) return 'risk';

  const warnFrom = new Date(d0);
  warnFrom.setDate(warnFrom.getDate() - 2);
  if (t0.getTime() >= warnFrom.getTime()) return 'warning';

  return null;
}

/**
 * Articles for the editorial calendar with readinessStatus attached.
 * @param {{ topicId?: string | null; categoryId?: string | null; status?: string | null }} [filters]
 */
export async function getCalendarArticles(filters = {}) {
  const rows = await getArticles(filters);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    publishDate: row.publishDate,
    readinessDeadline: row.readinessDeadline,
    readinessStatus: computeReadiness(row),
    status: row.status,
    topic: { id: row.topic.id, name: row.topic.name },
    category: { id: row.category.id, name: row.category.name },
  }));
}

/**
 * @param {string} [dateStr] yyyy-MM-dd
 * @returns {Date | null}
 */
function parseDateOnlyToUtcNoon(dateStr) {
  if (!dateStr || !String(dateStr).trim()) return null;
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(
    Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0, 0),
  );
}

/**
 * @param {import('@prisma/client').Prisma.JsonValue} [content]
 * @returns {import('@prisma/client').Prisma.JsonValue}
 */
function normalizeContent(content) {
  if (content == null) return null;
  if (typeof content === 'object' && !Array.isArray(content) && content.type === 'doc') {
    return content;
  }
  return null;
}

/**
 * @param {{ topicId?: string | null; categoryId?: string | null; status?: string | null }} [filters]
 */
export async function getArticles(filters = {}) {
  const { topicId, categoryId, status } = filters;

  const where = {
    ...(topicId ? { topicId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(status && status !== 'all' ? { status } : {}),
  };

  return prisma.article.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      topic: { select: { id: true, name: true, targetKeyword: true } },
      category: { select: { id: true, name: true } },
    },
  });
}

/**
 * @param {string} id
 */
export async function getArticleById(id) {
  return prisma.article.findUnique({
    where: { id },
    include: {
      topic: { select: { id: true, name: true, targetKeyword: true } },
      category: { select: { id: true, name: true } },
    },
  });
}

/**
 * @param {string} articleId
 */
export async function getArticleContentLogs(articleId) {
  return getContentLogsByEntity('article', articleId);
}

/**
 * @param {string} topicId
 * @param {string} categoryId
 */
async function assertTopicInCategory(topicId, categoryId) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) {
    const err = new Error('Topic not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (topic.categoryId !== categoryId) {
    const err = new Error('Category does not match the selected topic');
    err.code = 'VALIDATION';
    throw err;
  }
  return topic;
}

/**
 * @param {{
 *  title: string;
 *  summary?: string | null;
 *  topicId: string;
 *  categoryId: string;
 *  status: string;
 *  publishDate?: string | null;
 *  content?: import('@prisma/client').Prisma.JsonValue;
 *  featuredImage?: string | null;
 *  galleryImages?: string[];
 *  videoUrl?: string | null;
 *  isEditorsChoice?: boolean;
 *  seoScore?: number | null;
 *  wordpressPostId?: number | null;
 * }} data
 */
export async function createArticle(data) {
  if (!data.title?.trim()) {
    const err = new Error('Title is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!data.topicId?.trim() || !data.categoryId?.trim()) {
    const err = new Error('Topic and category are required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!ARTICLE_STATUS.has(data.status)) {
    const err = new Error('Invalid pipeline status');
    err.code = 'VALIDATION';
    throw err;
  }
  const topic = await assertTopicInCategory(data.topicId, data.categoryId);
  void topic; // only validation

  const publishDate = parseDateOnlyToUtcNoon(data.publishDate);
  const readinessDeadline =
    publishDate != null
      ? new Date(publishDate.getTime() - 7 * MS_PER_DAY)
      : null;

  const content = normalizeContent(data.content);
  const gallery = Array.isArray(data.galleryImages) ? data.galleryImages : [];

  return prisma.$transaction(async (tx) => {
    const row = await tx.article.create({
      data: {
        title: data.title.trim(),
        summary: data.summary?.trim() || null,
        content,
        featuredImage: data.featuredImage?.trim() || null,
        galleryImages: gallery,
        videoUrl: data.videoUrl?.trim() || null,
        isEditorsChoice: Boolean(data.isEditorsChoice),
        topicId: data.topicId,
        categoryId: data.categoryId,
        status: data.status,
        publishDate,
        readinessDeadline,
        seoScore: data.seoScore ?? null,
        wordpressPostId: data.wordpressPostId ?? null,
      },
      include: {
        topic: { select: { id: true, name: true, targetKeyword: true } },
        category: { select: { id: true, name: true } },
      },
    });
    await contentLog(
      {
        type: 'content',
        message: `Article created: ${row.title}`,
        entityType: 'article',
        entityId: row.id,
      },
      tx,
    );
    return row;
  });
}

/**
 * @param {string} id
 * @param {object} data
 */
export async function updateArticle(id, data) {
  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) {
    const err = new Error('Article not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!data.title?.trim()) {
    const err = new Error('Title is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!data.topicId?.trim() || !data.categoryId?.trim()) {
    const err = new Error('Topic and category are required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!ARTICLE_STATUS.has(data.status)) {
    const err = new Error('Invalid pipeline status');
    err.code = 'VALIDATION';
    throw err;
  }
  await assertTopicInCategory(data.topicId, data.categoryId);

  const publishDate = parseDateOnlyToUtcNoon(data.publishDate);
  const readinessDeadline =
    publishDate != null
      ? new Date(publishDate.getTime() - 7 * MS_PER_DAY)
      : null;

  const content = normalizeContent(data.content);
  const gallery = Array.isArray(data.galleryImages) ? data.galleryImages : [];

  return prisma.$transaction(async (tx) => {
    const row = await tx.article.update({
      where: { id },
      data: {
        title: data.title.trim(),
        summary: data.summary?.trim() || null,
        content,
        featuredImage: data.featuredImage?.trim() || null,
        galleryImages: gallery,
        videoUrl: data.videoUrl?.trim() || null,
        isEditorsChoice: Boolean(data.isEditorsChoice),
        topicId: data.topicId,
        categoryId: data.categoryId,
        status: data.status,
        publishDate,
        readinessDeadline,
        // seo / WP — keep existing if not sent (M4 form omits)
        seoScore: data.seoScore !== undefined ? data.seoScore : existing.seoScore,
        wordpressPostId:
          data.wordpressPostId !== undefined
            ? data.wordpressPostId
            : existing.wordpressPostId,
      },
      include: {
        topic: { select: { id: true, name: true, targetKeyword: true } },
        category: { select: { id: true, name: true } },
      },
    });
    await contentLog(
      {
        type: 'content',
        message: `Article updated: ${row.title}`,
        entityType: 'article',
        entityId: row.id,
      },
      tx,
    );
    return row;
  });
}

/**
 * @param {string} id
 */
export async function archiveOrDeleteArticle(id) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.article.findUnique({ where: { id } });
    if (!row) {
      const err = new Error('Article not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
    await contentLog(
      {
        type: 'content',
        message: `Article deleted: ${row.title}`,
        entityType: 'article',
        entityId: id,
      },
      tx,
    );
    await tx.article.delete({ where: { id } });
    return { deleted: true, id: row.id };
  });
}
