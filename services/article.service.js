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
 * @param {import('@prisma/client').Prisma.JsonValue | null | undefined} content
 */
function contentFingerprint(content) {
  if (content == null) return 'null';
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

/**
 * @param {import('@prisma/client').Article} existing
 * @param {object} data — same shape as updateArticle input (pre-normalize)
 */
function shouldSnapshotArticleBeforeUpdate(existing, data) {
  const nextTitle = data.title.trim();
  const nextSummary = data.summary?.trim() || null;
  const nextContent = normalizeContent(data.content);
  if (existing.title !== nextTitle) return true;
  if ((existing.summary ?? null) !== nextSummary) return true;
  return contentFingerprint(existing.content) !== contentFingerprint(nextContent);
}

function formatPipelineLabel(status) {
  return String(status).replace(/_/g, ' ');
}

/**
 * Persist a snapshot of the article before applying an update.
 * @param {import('@prisma/client').Article} article
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function createArticleVersion(article, tx, opts = {}) {
  await tx.articleVersion.create({
    data: {
      articleId: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content ?? null,
      createdBy: opts.createdBy ?? null,
    },
  });
}

/**
 * @param {string} articleId
 */
export async function getArticleVersions(articleId) {
  return prisma.articleVersion.findMany({
    where: { articleId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/**
 * @param {{ topicId?: string | null; categoryId?: string | null; status?: string | null }} [filters]
 */
export async function getArticles(filters = {}) {
  const { topicId, categoryId, status, approvedBySet, rejectedBySet, publishDateFrom, publishDateTo } = filters;

  const where = {
    ...(topicId ? { topicId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(status && status !== 'all' ? { status } : {}),
    ...(approvedBySet ? { approvedById: { not: null } } : {}),
    ...(rejectedBySet ? { rejectedById: { not: null } } : {}),
    ...(publishDateFrom || publishDateTo ? {
      publishDate: {
        ...(publishDateFrom ? { gte: new Date(publishDateFrom) } : {}),
        ...(publishDateTo ? { lte: new Date(publishDateTo + 'T23:59:59.999Z') } : {}),
      },
    } : {}),
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
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function createArticle(data, opts = {}) {
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
        type: 'article',
        action: 'create',
        message: `Article “${row.title}” created`,
        entityType: 'article',
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
 * @param {object} data
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function updateArticle(id, data, opts = {}) {
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

  const statusChanged = existing.status !== data.status;
  const snapshot = shouldSnapshotArticleBeforeUpdate(existing, data);

  return prisma.$transaction(async (tx) => {
    if (snapshot) {
      await createArticleVersion(existing, tx, { createdBy: opts.createdBy ?? null });
    }

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
    const logAction = statusChanged ? 'status_change' : 'update';
    const logMessage = statusChanged
      ? `Article “${row.title}” moved from ${formatPipelineLabel(existing.status)} to ${formatPipelineLabel(row.status)}`
      : `Article “${row.title}” updated`;

    await contentLog(
      {
        type: 'article',
        action: logAction,
        message: logMessage,
        entityType: 'article',
        entityId: row.id,
        metadata: statusChanged
          ? { fromStatus: existing.status, toStatus: row.status }
          : undefined,
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    return row;
  });
}

/**
 * Fetch research data for an article.
 * @param {string} articleId
 */
export async function getArticleResearch(articleId) {
  return prisma.articleResearch.findUnique({ where: { articleId } });
}

/**
 * Fetch asset requests for an article.
 * @param {string} articleId
 */
export async function getArticleAssetRequests(articleId) {
  return prisma.articleAssetRequest.findMany({
    where: { articleId },
    orderBy: { createdAt: 'asc' },
    include: {
      history: {
        orderBy: { version: 'asc' },
      },
    },
  });
}

/**
 * Fetch automation runs for an article.
 * @param {string} articleId
 */
export async function getArticleAutomationRuns(articleId) {
  return prisma.articleAutomationRun.findMany({
    where: { articleId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * @param {string} id
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function archiveOrDeleteArticle(id, opts = {}) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.article.findUnique({ where: { id } });
    if (!row) {
      const err = new Error('Article not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
    await contentLog(
      {
        type: 'article',
        action: 'delete',
        message: `Article “${row.title}” deleted`,
        entityType: 'article',
        entityId: id,
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );
    await tx.article.delete({ where: { id } });
    return { deleted: true, id: row.id };
  });
}
