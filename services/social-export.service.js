import path from 'path';
import fs from 'fs/promises';
import { chromium } from 'playwright';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getS3ClientInstance } from '@/lib/s3-client';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { getArticlePermalink } from '@/services/wordpress.service';

// ---------------------------------------------------------------------------
// Template configuration
// ---------------------------------------------------------------------------
const TEMPLATE_ROOT = path.join(process.cwd(), 'template-system');

const SLIDE_CONFIG = {
  'slide-': {
    subdir: 'carousel',
    viewport: { width: 420, height: 525 },
    deviceScaleFactor: 1080 / 420,
  },
  'story-': {
    subdir: 'story',
    viewport: { width: 420, height: 747 },
    deviceScaleFactor: 1080 / 420,
  },
  'linkedin-': {
    subdir: 'linkedin',
    viewport: { width: 600, height: 314 },
    deviceScaleFactor: 2.0,
  },
};

function getSlideConfig(slideId) {
  for (const [prefix, config] of Object.entries(SLIDE_CONFIG)) {
    if (slideId.startsWith(prefix)) return config;
  }
  throw new Error(`Unknown slide prefix for: ${slideId}`);
}

// ---------------------------------------------------------------------------
// Placeholder resolution
// ---------------------------------------------------------------------------

/**
 * Falls back to the bundled headshot at assets/photos/{firstname}.jpg when
 * the Section.characterImage CDN URL is not yet populated.
 * The path is relative to any template subdirectory (carousel/, story/, linkedin/)
 * so that ../assets/photos/ resolves correctly when loaded via page.goto file://.
 */
function writerPhotoPath(section) {
  const fullName = section.characterName || section.name || '';
  const firstName = fullName.split(' ')[0].toLowerCase();
  return firstName ? `../assets/photos/${firstName}.jpg` : '';
}

function buildPlaceholders(post, article, section, articleUrl, slideIndex, slideTotal) {
  const p = post.placeholders || {};
  return {
    HERO_IMAGE: article.featuredImage || '',
    ART_TITLE: p.ART_TITLE || article.title || '',
    WRITER_NAME: section.characterName || section.name || '',
    WRITER_NAME_UPPER: (section.characterName || section.name || '').toUpperCase(),
    WRITER_PHOTO: section.characterImage || writerPhotoPath(section),
    SECTION_NAME: section.name || '',
    SECTION_NAME_UPPER: (section.name || '').toUpperCase(),
    LABEL: p.LABEL || '',
    COLOR_ACCENT: section.colorAccent || '#CCB260',
    COLOR_LIGHT: section.colorLight || '#E0CC7A',
    COLOR_DARK: section.colorDark || '#7A5500',
    ARTICLE_URL: articleUrl,
    SLIDE_INDEX: slideIndex != null ? String(slideIndex) : '',
    SLIDE_TOTAL: slideTotal != null ? String(slideTotal) : '',
    SLIDE_PROGRESS: (slideIndex != null && slideTotal) ? String(Math.round((slideIndex / slideTotal) * 100)) : '0',
    // AI-generated placeholders
    HOOK: p.HOOK || '',
    QUOTE: p.QUOTE || '',
    STAT_N: p.STAT_N || '',
    STAT_L: p.STAT_L || '',
    NARRATIVE: p.NARRATIVE || '',
    FEAT_1_LABEL: p.FEAT_1_LABEL || '',
    FEAT_1_DESC: p.FEAT_1_DESC || '',
    FEAT_2_LABEL: p.FEAT_2_LABEL || '',
    FEAT_2_DESC: p.FEAT_2_DESC || '',
    FEAT_3_LABEL: p.FEAT_3_LABEL || '',
    FEAT_3_DESC: p.FEAT_3_DESC || '',
    FEAT_4_LABEL: p.FEAT_4_LABEL || '',
    FEAT_4_DESC: p.FEAT_4_DESC || '',
    STEP_1_TITLE: p.STEP_1_TITLE || '',
    STEP_1_DESC: p.STEP_1_DESC || '',
    STEP_2_TITLE: p.STEP_2_TITLE || '',
    STEP_2_DESC: p.STEP_2_DESC || '',
    STEP_3_TITLE: p.STEP_3_TITLE || '',
    STEP_3_DESC: p.STEP_3_DESC || '',
    IMGBOX_CAPTION: p.IMGBOX_CAPTION || '',
    END_CARD_BIO: p.END_CARD_BIO || '',
  };
}

function fillTemplate(html, placeholders) {
  return html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    return key in placeholders ? escapeHtml(String(placeholders[key])) : '';
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// S3 delete — extracts the key from a CDN/endpoint URL and removes it
// ---------------------------------------------------------------------------
export async function deleteFromS3(url) {
  try {
    const s3Client = getS3ClientInstance();
    const bucket = process.env.STORAGE_BUCKET || 'kghub';
    const cdnUrl = process.env.STORAGE_CDN_URL?.replace(/\/$/, '');
    const endpoint = process.env.STORAGE_ENDPOINT?.replace(/\/$/, '');

    // Strip the base URL to get the key
    let key = url;
    if (cdnUrl && url.startsWith(cdnUrl)) {
      key = url.slice(cdnUrl.length + 1);
    } else if (endpoint && url.startsWith(endpoint)) {
      // endpoint-style: https://endpoint/bucket/key → strip bucket prefix too
      key = url.slice(`${endpoint}/${bucket}/`.length);
    }

    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    // Non-fatal — old file may already be gone
  }
}

// ---------------------------------------------------------------------------
// S3 upload (buffer variant — no File object needed)
// ---------------------------------------------------------------------------
async function uploadBufferToS3(buffer, key) {
  const s3Client = getS3ClientInstance();
  const bucket = process.env.STORAGE_BUCKET || 'kghub';
  const cdnUrl = process.env.STORAGE_CDN_URL?.replace(/\/$/, '');
  const endpoint = process.env.STORAGE_ENDPOINT?.replace(/\/$/, '');

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000',
      ACL: 'public-read',
    }),
  );

  return cdnUrl ? `${cdnUrl}/${key}` : `${endpoint}/${key}`;
}

// ---------------------------------------------------------------------------
// exportPost — main export function
// ---------------------------------------------------------------------------
export async function exportPost(postId) {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: {
      article: {
        include: {
          category: {
            include: { section: true },
          },
        },
      },
    },
  });

  if (!post) throw new Error(`SocialPost not found: ${postId}`);
  if (post.slideIds.length === 0) throw new Error(`Post ${postId} has no slideIds`);

  const article = post.article;
  const section = article.category?.section;
  if (!section) throw new Error(`Article ${article.id} has no section`);

  // Fetch real article permalink from WordPress; fall back to empty string
  const articleUrl = (await getArticlePermalink(article, section)) ?? '';

  const slideTotal = post.slideIds.length;
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const platformDir = post.platform.replace('_', '/');

  // Update status to exporting and set total
  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status: 'exporting',
      exportTotal: post.slideIds.length,
      exportProgress: 0,
    },
  });

  const imageUrls = [];
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    for (let i = 0; i < post.slideIds.length; i++) {
      const slideId = post.slideIds[i];
      const slideConf = getSlideConfig(slideId);
      const templatePath = path.join(TEMPLATE_ROOT, slideConf.subdir, `${slideId}.html`);
      const templateDir = path.join(TEMPLATE_ROOT, slideConf.subdir);

      // Build placeholders with correct position for this slide
      const placeholders = buildPlaceholders(post, article, section, articleUrl, i + 1, slideTotal);
      const rawHtml = await fs.readFile(templatePath, 'utf-8');
      const filledHtml = fillTemplate(rawHtml, placeholders);

      // Write filled HTML to a temp file inside the template directory so that
      // page.goto('file://...') establishes a proper file:// origin. This is
      // required because page.setContent() with a file:// baseURL doesn't give
      // the page a real file origin, which causes Chromium to block both
      // @font-face files in parent directories AND external image requests.
      const tmpHtmlPath = path.join(templateDir, `_tmp-export-${Date.now()}-${i}.html`);
      await fs.writeFile(tmpHtmlPath, filledHtml);

      const context = await browser.newContext({
        viewport: slideConf.viewport,
        deviceScaleFactor: slideConf.deviceScaleFactor,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(90_000);

      try {
        await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle', timeout: 60_000 });
      } finally {
        await fs.unlink(tmpHtmlPath).catch(() => {});
      }

      // Wait for fonts, then let any CSS transitions/animations settle
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);

      // Ensure the export element is visible and stable before capturing
      const exportEl = page.locator('.export');
      await exportEl.waitFor({ state: 'visible', timeout: 30_000 });

      const screenshot = await exportEl.screenshot({
        type: 'png',
        timeout: 90_000,
        animations: 'disabled',
      });
      await context.close();

      // Upload to Spaces — include a random suffix so re-exports never hit cached URLs
      const rand = Math.random().toString(36).slice(2, 7);
      const s3Key = `social/${platformDir}/${dateStr}/${article.id}-${slideId}-${rand}.png`;
      const url = await uploadBufferToS3(screenshot, s3Key);
      imageUrls.push(url);

      // Update progress
      await prisma.socialPost.update({
        where: { id: postId },
        data: { exportProgress: i + 1 },
      });
    }

    // All slides done — mark uploaded
    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: 'uploaded',
        imageUrls,
        exportProgress: post.slideIds.length,
      },
    });

    return imageUrls;
  } catch (error) {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'failed', errorMessage: error.message },
    });
    throw error;
  } finally {
    await browser.close();
  }
}
