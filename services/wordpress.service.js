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
 * Sets article.wordpressPostId and advances status to 'publishing'.
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

  // Determine post status and date
  const now = new Date();
  const publishDate = article.publishDate ? new Date(article.publishDate) : null;
  const wpStatus = publishDate && publishDate > now ? 'future' : 'publish';
  const wpDate = publishDate ? publishDate.toISOString() : undefined;

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

    await prisma.article.update({
      where: { id: articleId },
      data: { wordpressPostId, status: 'publishing' },
    });

    await contentLog({
      type: 'article', action: 'status_change',
      message: `Article "${article.title}" published to WordPress (post ID ${wordpressPostId}, status: ${wpStatus})`,
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
