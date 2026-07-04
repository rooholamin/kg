import path from 'path';
import fs from 'fs/promises';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getS3ClientInstance } from '@/lib/s3-client';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { getArticlePermalink } from '@/services/wordpress.service';

// ---------------------------------------------------------------------------
// Template configuration
// ---------------------------------------------------------------------------
const TEMPLATE_ROOT = path.join(process.cwd(), 'template-system');

// Export format is now determined by platform, not by slide-ID prefix —
// LinkedIn reuses the exact same carousel dimensions/templates as Instagram Carousel.
const PLATFORM_EXPORT_CONFIG = {
  instagram_carousel: {
    subdir: 'carousel',
    viewport: { width: 420, height: 525 },
    deviceScaleFactor: 1080 / 420,
  },
  linkedin: {
    subdir: 'carousel',
    viewport: { width: 420, height: 525 },
    deviceScaleFactor: 1080 / 420,
  },
  instagram_story: {
    subdir: 'story',
    viewport: { width: 420, height: 747 },
    deviceScaleFactor: 1080 / 420,
  },
};

function getPlatformExportConfig(platform) {
  const config = PLATFORM_EXPORT_CONFIG[platform];
  if (!config) throw new Error(`No export config for platform: ${platform}`);
  return config;
}

// The content agent only ever selects the logical slide "01-cover" — the actual
// visual variant is resolved here, either randomly assigned at content-generation
// time (see social-pipeline.service.js) or overridden by a human via the edit modal.
const COVER_VARIANTS = {
  default: '01-cover.html',
  'bottom-anchor': '01-cover-bottom-anchor.html',
  'center-vignette': '01-cover-center-vignette.html',
  'left-panel': '01-cover-left-panel.html',
};

/**
 * Resolves a slide ID to its physical template filename, handling the
 * multi-variant cover slide.
 */
function resolveTemplateFilename(slideId, placeholders) {
  if (slideId === '01-cover') {
    return COVER_VARIANTS[placeholders.COVER_VARIANT] || COVER_VARIANTS.default;
  }
  return `${slideId}.html`;
}

// ---------------------------------------------------------------------------
// Placeholder resolution
// ---------------------------------------------------------------------------

/**
 * Falls back to the bundled headshot at assets/{firstname}.jpg when the
 * Section.characterImage CDN URL is not yet populated. The path is relative
 * to any template subdirectory (carousel/, story/) so that ../assets/ resolves
 * correctly when loaded via page.goto file://.
 */
function writerPhotoPath(section) {
  const fullName = section.characterName || section.name || '';
  const firstName = fullName.split(' ')[0].toLowerCase();
  return firstName ? `../assets/${firstName}.jpg` : '';
}

function buildPlaceholders(post, article, section, articleUrl, slideIndex, slideTotal, slideId) {
  const p = post.placeholders || {};
  const slideImages = post.slideImages || {};
  return {
    HERO_IMAGE: slideImages[slideId] || article.featuredImage || '../assets/hero-default.jpg',
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
async function uploadBufferToS3(buffer, key, contentType = 'image/jpeg') {
  const s3Client = getS3ClientInstance();
  const bucket = process.env.STORAGE_BUCKET || 'kghub';
  const cdnUrl = process.env.STORAGE_CDN_URL?.replace(/\/$/, '');
  const endpoint = process.env.STORAGE_ENDPOINT?.replace(/\/$/, '');

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
      ACL: 'public-read',
    }),
  );

  return cdnUrl ? `${cdnUrl}/${key}` : `${endpoint}/${key}`;
}

// ---------------------------------------------------------------------------
// buildLinkedInCarouselDocument — LinkedIn removed native image carousels in
// Dec 2023; multiple `image` assets just render as a static grid. The only
// way to get a swipeable "carousel" on LinkedIn is a PDF document post, so we
// stitch the already-exported slide images (one per page, full-bleed) into a
// single PDF and upload it alongside the images.
// ---------------------------------------------------------------------------
export async function buildLinkedInCarouselDocument(post, article) {
  const pdfDoc = await PDFDocument.create();

  for (const url of post.imageUrls) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch slide image for PDF: ${url}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || '';
    const image = contentType.includes('png')
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  const pdfBytes = await pdfDoc.save();
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const rand = Math.random().toString(36).slice(2, 7);
  const s3Key = `social/linkedin/${dateStr}/${article.id}-carousel-${rand}.pdf`;
  const url = await uploadBufferToS3(Buffer.from(pdfBytes), s3Key, 'application/pdf');

  return {
    url,
    title: article.title.slice(0, 100),
    thumbnailUrl: post.imageUrls[0],
  };
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
  if (post.slideIds.length === 0) {
    // Can happen when the content agent returns a slideId that doesn't match
    // this platform's valid template list (e.g. a carousel-style ID for a
    // Story post) — the defensive filter in generatePostContent then strips
    // it, leaving an empty array. Mark the post failed here (rather than just
    // throwing) so it doesn't sit silently stuck at "content_ready" forever.
    const message = `Post ${postId} has no slideIds — content generation returned an empty or invalid slide selection. Try Regenerate.`;
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'failed', errorMessage: message },
    });
    throw new Error(message);
  }

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

  const slideConf = getPlatformExportConfig(post.platform);
  const templateDir = path.join(TEMPLATE_ROOT, slideConf.subdir);

  try {
    for (let i = 0; i < post.slideIds.length; i++) {
      const slideId = post.slideIds[i];

      // Build placeholders with correct position for this slide
      const placeholders = buildPlaceholders(post, article, section, articleUrl, i + 1, slideTotal, slideId);
      const templateFilename = resolveTemplateFilename(slideId, post.placeholders || {});
      const templatePath = path.join(templateDir, templateFilename);
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

      // Confirmed via direct Buffer API testing (2026-07-04): images over ~8MB
      // get a bare "Invalid post: " MutationError with zero detail — Buffer's
      // docs claim oversized images get auto-resized, but that doesn't happen
      // through the createPost API, only the web composer's own upload flow.
      // Our full-bleed PNG screenshots were routinely 5-9MB; JPEG-90 keeps
      // every slide well under the limit.
      const screenshot = await exportEl.screenshot({
        type: 'jpeg',
        quality: 90,
        timeout: 90_000,
        animations: 'disabled',
      });
      await context.close();

      // Upload to Spaces — include a random suffix so re-exports never hit cached URLs
      const rand = Math.random().toString(36).slice(2, 7);
      const s3Key = `social/${platformDir}/${dateStr}/${article.id}-${slideId}-${rand}.jpg`;
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
