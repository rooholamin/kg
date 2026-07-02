import { prisma } from '@/lib/prisma';
import { contentLog } from '@/services/content-log.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Basic Auth header value from WP Application Password credentials.
 * @param {string} username
 * @param {string} appPassword
 */
function basicAuth(username, appPassword) {
  return 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');
}

/**
 * Normalise a WP site URL — strip trailing slash, ensure https is not doubled.
 * @param {string} siteUrl
 */
function normaliseUrl(siteUrl) {
  return siteUrl.replace(/\/+$/, '');
}

/**
 * Convert TipTap/ProseMirror JSON content to an HTML string.
 * Also handles the `{ type: 'html', html: '...' }` passthrough format.
 * Returns an empty string if content is null/undefined.
 * @param {object | null} content
 * @returns {string}
 */
function contentToHtml(content) {
  if (!content) return '';

  // Passthrough HTML format
  if (content.type === 'html' && typeof content.html === 'string') {
    return content.html;
  }

  // TipTap doc JSON — convert nodes to HTML manually (server-safe, no DOM)
  if (content.type === 'doc' && Array.isArray(content.content)) {
    return nodesToHtml(content.content);
  }

  return '';
}

function nodesToHtml(nodes) {
  if (!Array.isArray(nodes)) return '';
  return nodes.map(nodeToHtml).join('');
}

function nodeToHtml(node) {
  if (!node) return '';
  const inner = node.content ? nodesToHtml(node.content) : '';
  const text = node.text ?? '';

  switch (node.type) {
    case 'doc': return nodesToHtml(node.content);
    case 'paragraph': return `<p>${inner || text}</p>`;
    case 'heading': {
      const level = node.attrs?.level ?? 2;
      return `<h${level}>${inner || text}</h${level}>`;
    }
    case 'text': {
      let out = escapeHtml(text);
      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case 'bold': out = `<strong>${out}</strong>`; break;
            case 'italic': out = `<em>${out}</em>`; break;
            case 'underline': out = `<u>${out}</u>`; break;
            case 'strike': out = `<s>${out}</s>`; break;
            case 'code': out = `<code>${out}</code>`; break;
            case 'link':
              out = `<a href="${escapeAttr(mark.attrs?.href ?? '')}">${out}</a>`;
              break;
          }
        }
      }
      return out;
    }
    case 'bulletList': return `<ul>${inner}</ul>`;
    case 'orderedList': return `<ol>${inner}</ol>`;
    case 'listItem': return `<li>${inner}</li>`;
    case 'blockquote': return `<blockquote>${inner}</blockquote>`;
    case 'codeBlock': return `<pre><code>${escapeHtml(text)}${inner}</code></pre>`;
    case 'hardBreak': return '<br>';
    case 'horizontalRule': return '<hr>';
    case 'image': {
      const src = escapeAttr(node.attrs?.src ?? '');
      const alt = escapeAttr(node.attrs?.alt ?? '');
      return src ? `<img src="${src}" alt="${alt}">` : '';
    }
    // Skip placeholder nodes
    case 'imagePlaceholder': return '';
    default: return inner || text;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

/**
 * Call the kghub-featured-image mu-plugin to create a virtual WP attachment
 * record (DB only, no file stored) and set it as the post's featured image.
 * Returns the attachment ID on success, or null on failure.
 * @param {string} wpSiteUrl
 * @param {number} wpPostId
 * @param {string} imageUrl
 * @param {string} title
 * @returns {Promise<number | null>}
 */
async function setFeaturedImageViaPlugin(wpSiteUrl, wpPostId, imageUrl, title) {
  const secret = process.env.WP_KGHUB_SECRET;
  if (!secret) return null;

  const base = normaliseUrl(wpSiteUrl);
  try {
    const res = await fetch(`${base}/wp-json/kghub/v1/set-featured-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kghub-Secret': secret,
      },
      body: JSON.stringify({ post_id: wpPostId, image_url: imageUrl, title }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.attachment_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Pick a random quarter-hour publish time on the same calendar day as
 * `publishDate`, between 09:00 and 20:00 inclusive.
 *
 * Returns a timezone-naive ISO string (e.g. "2026-06-25T14:15:00") so
 * WordPress interprets it in the site's own configured timezone rather than
 * UTC.  `publishDate` is stored as midnight UTC in the DB, so we always read
 * year/month/day from the UTC components.
 *
 * Slots: 09:00, 09:15, 09:30 … 19:45, 20:00 (45 slots total).
 *
 * @param {Date} publishDate
 * @returns {string}
 */
function randomPublishDateTime(publishDate) {
  const year  = publishDate.getUTCFullYear();
  const month = String(publishDate.getUTCMonth() + 1).padStart(2, '0');
  const day   = String(publishDate.getUTCDate()).padStart(2, '0');

  const FIRST_QUARTER = 9 * 4;   // 09:00 in quarter-hours from midnight
  const LAST_QUARTER  = 20 * 4;  // 20:00 in quarter-hours from midnight
  const totalSlots = LAST_QUARTER - FIRST_QUARTER + 1; // 45

  const slot         = Math.floor(Math.random() * totalSlots);
  const totalMinutes = (FIRST_QUARTER + slot) * 15;
  const hour         = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minute       = String(totalMinutes % 60).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:00`;
}

/**
 * Make an authenticated request to the WP REST API.
 * @param {string} url
 * @param {{ username: string; appPassword: string }} creds
 * @param {RequestInit} [options]
 */
async function wpFetch(url, creds, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(creds.username, creds.appPassword),
      ...(options.headers ?? {}),
    },
  });
  return res;
}

// ---------------------------------------------------------------------------
// Category sync
// ---------------------------------------------------------------------------

/**
 * Sync a single Category to WordPress as a top-level WP category.
 * Uses the section's WP credentials. Idempotent — re-sync is safe.
 * @param {string} categoryId
 * @param {string | null} [userId]
 * @returns {Promise<{ wpCategoryId: number; created: boolean }>}
 */
export async function syncCategoryToWordPress(categoryId, userId = null) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { section: true },
  });

  if (!category) {
    const err = new Error('Category not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const section = category.section;
  if (!section?.wpSiteUrl || !section?.wpUsername || !section?.wpAppPassword) {
    const err = new Error(
      `Section "${section?.name ?? 'unknown'}" has no WordPress credentials configured`,
    );
    err.code = 'VALIDATION';
    throw err;
  }

  const base = normaliseUrl(section.wpSiteUrl);
  const creds = { username: section.wpUsername, appPassword: section.wpAppPassword };

  // Check if a category with this name already exists in WP
  const searchRes = await wpFetch(
    `${base}/wp-json/wp/v2/categories?search=${encodeURIComponent(category.name)}&per_page=20`,
    creds,
  );

  if (!searchRes.ok) {
    throw new Error(`WordPress API error (search): ${searchRes.status} ${searchRes.statusText}`);
  }

  const existing = await searchRes.json();
  const match = existing.find(
    (c) => c.name.toLowerCase() === category.name.toLowerCase() && c.parent === 0,
  );

  let wpCategoryId;
  let created = false;

  if (match) {
    wpCategoryId = match.id;
  } else {
    // Create it
    const createRes = await wpFetch(`${base}/wp-json/wp/v2/categories`, creds, {
      method: 'POST',
      body: JSON.stringify({
        name: category.name,
        description: category.description ?? '',
      }),
    });

    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      throw new Error(
        `WordPress API error (create category): ${createRes.status} — ${body?.message ?? createRes.statusText}`,
      );
    }

    const created_ = await createRes.json();
    wpCategoryId = created_.id;
    created = true;
  }

  await prisma.category.update({ where: { id: categoryId }, data: { wpCategoryId } });

  await contentLog({
    type: 'category',
    action: 'update',
    message: `Category "${category.name}" ${created ? 'created' : 'linked'} in WordPress (ID ${wpCategoryId})`,
    entityType: 'category',
    entityId: categoryId,
    createdBy: userId,
  });

  return { wpCategoryId, created };
}

// ---------------------------------------------------------------------------
// Topic sync
// ---------------------------------------------------------------------------

/**
 * Sync a single Topic to WordPress as a child WP category under its parent.
 * The parent category must already be synced (have a wpCategoryId).
 * @param {string} topicId
 * @param {string | null} [userId]
 * @returns {Promise<{ wpCategoryId: number; created: boolean }>}
 */
export async function syncTopicToWordPress(topicId, userId = null) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { category: { include: { section: true } } },
  });

  if (!topic) {
    const err = new Error('Topic not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const category = topic.category;
  const section = category?.section;

  if (!section?.wpSiteUrl || !section?.wpUsername || !section?.wpAppPassword) {
    const err = new Error(
      `Section "${section?.name ?? 'unknown'}" has no WordPress credentials configured`,
    );
    err.code = 'VALIDATION';
    throw err;
  }

  if (!category.wpCategoryId) {
    const err = new Error(
      `Parent category "${category.name}" has not been synced to WordPress yet — sync categories first`,
    );
    err.code = 'VALIDATION';
    throw err;
  }

  const base = normaliseUrl(section.wpSiteUrl);
  const creds = { username: section.wpUsername, appPassword: section.wpAppPassword };

  // Check if a child category with this name already exists under the parent
  const searchRes = await wpFetch(
    `${base}/wp-json/wp/v2/categories?search=${encodeURIComponent(topic.name)}&parent=${category.wpCategoryId}&per_page=20`,
    creds,
  );

  if (!searchRes.ok) {
    throw new Error(`WordPress API error (search): ${searchRes.status} ${searchRes.statusText}`);
  }

  const existing = await searchRes.json();
  const match = existing.find(
    (c) =>
      c.name.toLowerCase() === topic.name.toLowerCase() &&
      c.parent === category.wpCategoryId,
  );

  let wpCategoryId;
  let created = false;

  if (match) {
    wpCategoryId = match.id;
  } else {
    const createRes = await wpFetch(`${base}/wp-json/wp/v2/categories`, creds, {
      method: 'POST',
      body: JSON.stringify({
        name: topic.name,
        description: topic.description ?? '',
        parent: category.wpCategoryId,
      }),
    });

    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      throw new Error(
        `WordPress API error (create sub-category): ${createRes.status} — ${body?.message ?? createRes.statusText}`,
      );
    }

    const created_ = await createRes.json();
    wpCategoryId = created_.id;
    created = true;
  }

  await prisma.topic.update({ where: { id: topicId }, data: { wpCategoryId } });

  await contentLog({
    type: 'topic',
    action: 'update',
    message: `Topic "${topic.name}" ${created ? 'created' : 'linked'} as WordPress sub-category (ID ${wpCategoryId}) under "${category.name}"`,
    entityType: 'topic',
    entityId: topicId,
    createdBy: userId,
  });

  return { wpCategoryId, created };
}

// ---------------------------------------------------------------------------
// Article publish
// ---------------------------------------------------------------------------

/**
 * Publish an article to WordPress using its section's credentials.
 * Sets article.wordpressPostId and advances status to 'post_publish'.
 * On failure, logs the error and leaves status as 'scheduling' (retryable).
 * @param {string} articleId
 * @param {string | null} [userId]
 */
export async function publishArticleToWordPress(articleId, userId = null) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      topic: { include: { category: { include: { section: true } } } },
      category: { include: { section: true } },
    },
  });

  if (!article) {
    const err = new Error('Article not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const category = article.category;
  const topic = article.topic;
  const section = category?.section ?? topic?.category?.section;

  if (!section?.wpSiteUrl || !section?.wpUsername || !section?.wpAppPassword) {
    await contentLog({
      type: 'article', action: 'status_change',
      message: `WordPress publish failed for "${article.title}": section has no WP credentials`,
      entityType: 'article', entityId: articleId,
      createdBy: userId,
    });
    return { ok: false, error: 'No WordPress credentials on section' };
  }

  const base = normaliseUrl(section.wpSiteUrl);
  const creds = { username: section.wpUsername, appPassword: section.wpAppPassword };

  // Build the categories array — include both category and topic WP IDs if available
  const wpCategories = [
    category?.wpCategoryId,
    topic?.wpCategoryId,
  ].filter(Boolean);

  // Determine post status and date.
  // The time is randomised to a quarter-hour slot between 09:00 and 20:00 in
  // the WordPress site's local timezone (timezone-naive string, no Z suffix).
  const now = new Date();
  const publishDate = article.publishDate ? new Date(article.publishDate) : null;
  const wpDate = publishDate ? randomPublishDateTime(publishDate) : undefined;
  // Compare against a Date built from the naive string to decide future vs publish
  const wpDateObj = wpDate ? new Date(wpDate) : null;
  const wpStatus = wpDateObj && wpDateObj > now ? 'future' : 'publish';

  // Convert content to HTML
  const htmlContent = contentToHtml(article.content);

  const payload = {
    title: article.title,
    content: htmlContent,
    status: wpStatus,
    ...(wpDate ? { date: wpDate } : {}),
    ...(section.wpAuthorId ? { author: section.wpAuthorId } : {}),
    ...(wpCategories.length > 0 ? { categories: wpCategories } : {}),
    ...(article.metaDescription
      ? { excerpt: article.metaDescription }
      : article.summary
        ? { excerpt: article.summary }
        : {}),
    // FIFU (Featured Image from URL) plugin — set featured image via S3 URL directly
    ...(article.featuredImage
      ? { meta: { fifu_image_url: article.featuredImage, fifu_image_alt: article.title } }
      : {}),
  };

  try {
    const res = await wpFetch(`${base}/wp-json/wp/v2/posts`, creds, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errMsg = body?.message ?? `HTTP ${res.status}`;
      throw new Error(errMsg);
    }

    const wpPost = await res.json();
    const wordpressPostId = wpPost.id;

    // Create a virtual WP attachment record pointing to the S3 URL (no file upload)
    // and set it as the post's featured image. This replicates what FIFU does on
    // admin save, making the image visible on homepage/archive templates immediately.
    let imageNote = '';
    if (article.featuredImage) {
      const attachmentId = await setFeaturedImageViaPlugin(
        section.wpSiteUrl,
        wordpressPostId,
        article.featuredImage,
        article.title,
      );
      imageNote = attachmentId
        ? `, featured image set (attachment ${attachmentId})`
        : ', featured image: mu-plugin not available, FIFU meta only';
    }

    await prisma.article.update({
      where: { id: articleId },
      data: { wordpressPostId, status: 'post_publish' },
    });

    await contentLog({
      type: 'article', action: 'status_change',
      message: `Article "${article.title}" published to WordPress (post ID ${wordpressPostId}, status: ${wpStatus}${imageNote})`,
      entityType: 'article', entityId: articleId,
      createdBy: userId,
    });

    return { ok: true, wordpressPostId, wpStatus };
  } catch (err) {
    await contentLog({
      type: 'article', action: 'status_change',
      message: `WordPress publish failed for "${article.title}": ${err.message}`,
      entityType: 'article', entityId: articleId,
      createdBy: userId,
    });

    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// getArticlePermalink
// ---------------------------------------------------------------------------

/**
 * Fetch the canonical permalink for an article from the WordPress REST API.
 * Returns the URL string on success, or null on any failure (missing WP post
 * ID, unreachable site, non-200 response, etc.) — callers must handle null.
 *
 * @param {{ wordpressPostId?: number | null }} article
 * @param {{ wpSiteUrl?: string | null }} section
 * @returns {Promise<string | null>}
 */
export async function getArticlePermalink(article, section) {
  if (!article?.wordpressPostId || !section?.wpSiteUrl) return null;
  try {
    const base = normaliseUrl(section.wpSiteUrl);
    const res = await fetch(
      `${base}/wp-json/wp/v2/posts/${article.wordpressPostId}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.link ?? null;
  } catch {
    return null;
  }
}
