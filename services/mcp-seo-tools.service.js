/**
 * Tool implementations behind the internal SEO MCP server (app/api/mcp/seo).
 * Called directly by Anthropic's Managed Agents infrastructure when the
 * seo-agent / kingsgate-linking-agent invoke a tool mid-session — never by
 * our own app code. Keep this file's surface minimal and deterministic:
 * WordPress credentials never leave this file, and every write goes through
 * the exact same auth/fetch helpers used by the existing publish flow
 * (services/wordpress.service.js) so behavior stays consistent.
 */
import { prisma } from '@/lib/prisma';
import { normaliseUrl, wpFetch } from '@/services/wordpress.service';
import { contentLog } from '@/services/content-log.service';

// ---------------------------------------------------------------------------
// update_article — used by BOTH agents: the seo-agent for on-page fixes, and
// the kingsgate-linking-agent to insert its one chosen link into the winning
// article's body. Only the fields provided are touched. Writes to the KGHub
// Article row (source of truth for future edits) AND pushes the same change
// to the live WordPress post via the article's own Section credentials —
// exactly the same resolution `publishArticleToWordPress` already uses.
// ---------------------------------------------------------------------------
export async function updateArticleTool({ articleId, title, metaDescription, contentHtml } = {}) {
  if (!articleId || typeof articleId !== 'string') {
    return { ok: false, error: 'articleId is required' };
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      topic: { include: { category: { include: { section: true } } } },
      category: { include: { section: true } },
    },
  });
  if (!article) {
    return { ok: false, error: `Article ${articleId} not found` };
  }

  const section = article.category?.section ?? article.topic?.category?.section;
  if (!section?.wpSiteUrl || !section?.wpUsername || !section?.wpAppPassword) {
    return { ok: false, error: "This article's section has no WordPress credentials configured" };
  }
  if (!article.wordpressPostId) {
    return { ok: false, error: 'This article has not been published to WordPress yet (no wordpressPostId)' };
  }

  const dataToSave = {};
  const wpPayload = {};

  if (typeof title === 'string' && title.trim()) {
    dataToSave.title = title.trim();
    wpPayload.title = title.trim();
  }
  if (typeof metaDescription === 'string' && metaDescription.trim()) {
    dataToSave.metaDescription = metaDescription.trim();
    wpPayload.excerpt = metaDescription.trim();
  }
  if (typeof contentHtml === 'string' && contentHtml.trim()) {
    dataToSave.content = { type: 'html', html: contentHtml };
    wpPayload.content = contentHtml;
  }

  if (Object.keys(wpPayload).length === 0) {
    return { ok: false, error: 'No fields provided — pass at least one of title, metaDescription, contentHtml' };
  }

  const base = normaliseUrl(section.wpSiteUrl);
  const creds = { username: section.wpUsername, appPassword: section.wpAppPassword };

  try {
    const res = await wpFetch(`${base}/wp-json/wp/v2/posts/${article.wordpressPostId}`, creds, {
      method: 'POST',
      body: JSON.stringify(wpPayload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `WordPress update failed: ${body?.message ?? `HTTP ${res.status}`}` };
    }

    const updated = await res.json();

    await prisma.$transaction([
      // Snapshot before overwriting — consistent with "nothing is overwritten"
      // elsewhere in this app (see ArticleVersion usage in article-automation.service.js).
      prisma.articleVersion.create({
        data: {
          articleId: article.id,
          title: article.title,
          summary: article.summary,
          content: article.content,
          versionLabel: 'Pre-SEO snapshot',
          createdBy: null,
        },
      }),
      prisma.article.update({ where: { id: article.id }, data: dataToSave }),
    ]);

    await contentLog({
      type: 'article',
      action: 'update',
      message: `SEO agent updated "${article.title}" (${Object.keys(dataToSave).join(', ')})`,
      entityType: 'article',
      entityId: article.id,
    });

    return { ok: true, permalink: updated?.link ?? null, updatedFields: Object.keys(dataToSave) };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'WordPress request failed' };
  }
}

// ---------------------------------------------------------------------------
// get_kingsgate_posts_for_feature — read-only, used ONLY by the
// kingsgate-linking-agent. Deterministic exact lookup by taxonomy term id
// (the agent already has the static id->name list embedded in its prompt —
// see scripts/sync-kingsgate-features.mjs) against kingsgateluxuryhomes.com's
// regular `post` type. Never the `project` custom post type — posts only.
// ---------------------------------------------------------------------------
export async function getKingsgatePostsForFeatureTool({ featureId } = {}) {
  const username = process.env.KINGSGATE_WP_USERNAME;
  const appPassword = process.env.KINGSGATE_WP_APP_PASSWORD;
  const siteUrl = process.env.KINGSGATE_WP_SITE_URL || 'https://kingsgateluxuryhomes.com';

  if (!username || !appPassword) {
    return { ok: false, error: 'Kingsgate WordPress credentials are not configured on the server' };
  }
  const id = Number(featureId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'featureId must be a positive integer (the WordPress term id from your reference list)' };
  }

  try {
    const base = normaliseUrl(siteUrl);
    const url = `${base}/wp-json/wp/v2/posts?features=${id}&per_page=10&_fields=id,title,link,excerpt`;
    const res = await wpFetch(url, { username, appPassword: appPassword });
    if (!res.ok) {
      return { ok: false, error: `Kingsgate WordPress API error: HTTP ${res.status}` };
    }
    const posts = await res.json();
    return {
      ok: true,
      posts: (Array.isArray(posts) ? posts : []).map((p) => ({
        id: p.id,
        title: p.title?.rendered ?? '',
        url: p.link,
        excerpt: (p.excerpt?.rendered ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      })),
    };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'Kingsgate WordPress request failed' };
  }
}
