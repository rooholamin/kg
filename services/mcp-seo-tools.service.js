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

// ---------------------------------------------------------------------------
// News Writer tools — used ONLY by news-writer-agent.yaml (a standalone
// Scheduled Deployment, not driven by any KGHub service). These 3 tools are
// the entire bridge between that agent and insights.kghub.ca: the agent has
// no other way to read/write WordPress. Deliberately stateless — no DB
// tracking of this job at all, per the "no audit" decision.
// ---------------------------------------------------------------------------

/** Regex for the crawler's trailing plain-text citation line, e.g. "source: https://..." */
const SOURCE_LINE_RE = /source:\s*(https?:\/\/\S+)/i;
// Matches the whole trailing block containing that line (a <p> tag, optionally
// preceded by whitespace/newlines, with an optional trailing <br>), so it can
// be stripped from the body handed to the agent.
const SOURCE_BLOCK_RE = /<p>\s*source:\s*https?:\/\/\S+\s*(?:<br\s*\/?>)?\s*<\/p>\s*$/i;

/** Any one Section's WordPress credentials for insights.kghub.ca — confirmed
 * live that these are Editor-level (can see private posts site-wide, not
 * just their own). Used only for reads and the delete-with-media call;
 * the final publish always authenticates as the MATCHED section itself. */
async function getAnySectionCreds() {
  const section = await prisma.section.findFirst({
    where: { wpSiteUrl: { not: null }, wpUsername: { not: null }, wpAppPassword: { not: null } },
    orderBy: { name: 'asc' },
  });
  if (!section) return null;
  return {
    base: normaliseUrl(section.wpSiteUrl),
    creds: { username: section.wpUsername, appPassword: section.wpAppPassword },
  };
}

function stripHtmlTags(html) {
  return String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * get_next_private_post — finds the newest private-status post on
 * insights.kghub.ca (no tag filter — private status is used exclusively by
 * this news pipeline), extracts and strips the crawler's trailing
 * "source: <url>" citation line, and returns it alongside all 7 Sections'
 * classification blurb + full persona, pulled live from the Section table
 * (not hardcoded) — one call gives the agent everything it needs to decide
 * relevance, pick a section, and write in that persona's voice.
 */
export async function getNextPrivatePostTool() {
  const anyCreds = await getAnySectionCreds();
  if (!anyCreds) {
    return { ok: false, error: 'No Section has WordPress credentials configured for insights.kghub.ca' };
  }

  try {
    const listRes = await wpFetch(
      `${anyCreds.base}/wp-json/wp/v2/posts?status=private&per_page=1&orderby=date&order=desc&_fields=id,title,content,excerpt,link,featured_media`,
      anyCreds.creds,
    );
    if (!listRes.ok) {
      return { ok: false, error: `WordPress query failed: HTTP ${listRes.status}` };
    }
    const posts = await listRes.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      return { ok: true, found: false };
    }
    const post = posts[0];

    const rawContent = post.content?.rendered ?? '';
    const sourceMatch = rawContent.match(SOURCE_LINE_RE);
    const sourceUrl = sourceMatch ? sourceMatch[1] : null;
    const contentHtml = rawContent.replace(SOURCE_BLOCK_RE, '').trim();

    let featuredImageUrl = null;
    if (post.featured_media) {
      try {
        const mediaRes = await wpFetch(
          `${anyCreds.base}/wp-json/wp/v2/media/${post.featured_media}?_fields=source_url`,
          anyCreds.creds,
        );
        if (mediaRes.ok) {
          const media = await mediaRes.json();
          featuredImageUrl = media?.source_url ?? null;
        }
      } catch {
        // Non-fatal — the agent can still write the article without the image.
      }
    }

    const sections = await prisma.section.findMany({
      where: { slug: { startsWith: 'kg-' } },
      select: {
        slug: true,
        name: true,
        description: true,
        characterName: true,
        characterBackground: true,
        characterRole: true,
        characterBiography: true,
        characterTone: true,
        characterWritingStyle: true,
        characterPersona: true,
        characterSampleVoice: true,
      },
      orderBy: { slug: 'asc' },
    });

    return {
      ok: true,
      found: true,
      post: {
        id: post.id,
        title: stripHtmlTags(post.title?.rendered ?? ''),
        contentHtml,
        sourceUrl,
        featuredImageUrl,
      },
      sections,
    };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'WordPress request failed' };
  }
}

/**
 * delete_post_with_media — hard-deletes a non-matching post AND its media
 * via the site's custom kg/v1 route (the exact same endpoint the old
 * "KG News Manager" n8n workflow already used for its Telegram delete
 * button). No undo, no log — per the explicit "delete non-matches" decision.
 */
export async function deletePostWithMediaTool({ postId } = {}) {
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'postId must be a positive integer' };
  }

  const anyCreds = await getAnySectionCreds();
  if (!anyCreds) {
    return { ok: false, error: 'No Section has WordPress credentials configured for insights.kghub.ca' };
  }

  try {
    const res = await wpFetch(`${anyCreds.base}/wp-json/kg/v1/posts/${id}/delete-with-media`, anyCreds.creds, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `Delete failed: ${body?.message ?? `HTTP ${res.status}`}` };
    }
    return { ok: true, deleted: id };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'WordPress request failed' };
  }
}

/**
 * publish_news_post — resolves sectionSlug to its real Section row
 * server-side (the agent only ever supplies a slug, never a WordPress
 * author id directly) and authenticates as THAT section's own WordPress
 * account to publish — same author-resolution pattern already proven in
 * services/wordpress.service.js's publishArticleToWordPress, so no account
 * ever needs permission to impersonate a different one.
 */
export async function publishNewsPostTool({ postId, sectionSlug, title, contentHtml } = {}) {
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'postId must be a positive integer' };
  }
  if (!sectionSlug || typeof sectionSlug !== 'string') {
    return { ok: false, error: 'sectionSlug is required (one of the slugs from get_next_private_post\'s sections list)' };
  }
  if (!contentHtml || typeof contentHtml !== 'string' || !contentHtml.trim()) {
    return { ok: false, error: 'contentHtml is required — the full rewritten article body' };
  }

  const section = await prisma.section.findUnique({ where: { slug: sectionSlug } });
  if (!section) {
    return { ok: false, error: `Unknown sectionSlug "${sectionSlug}" — use one of the slugs from get_next_private_post's sections list` };
  }
  if (!section.wpSiteUrl || !section.wpUsername || !section.wpAppPassword) {
    return { ok: false, error: `Section "${sectionSlug}" has no WordPress credentials configured` };
  }
  if (!section.wpAuthorId) {
    return { ok: false, error: `Section "${sectionSlug}" has no wpAuthorId configured — cannot set authorship` };
  }

  const base = normaliseUrl(section.wpSiteUrl);
  const creds = { username: section.wpUsername, appPassword: section.wpAppPassword };

  const payload = {
    content: contentHtml,
    author: section.wpAuthorId,
    status: 'publish',
    tags: [],
  };
  if (typeof title === 'string' && title.trim()) {
    payload.title = title.trim();
  }

  try {
    const res = await wpFetch(`${base}/wp-json/wp/v2/posts/${id}`, creds, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `WordPress publish failed: ${body?.message ?? `HTTP ${res.status}`}` };
    }
    const updated = await res.json();
    return { ok: true, permalink: updated?.link ?? null, section: sectionSlug, author: section.characterName };
  } catch (err) {
    return { ok: false, error: err?.message ?? 'WordPress request failed' };
  }
}
