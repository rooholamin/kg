import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * GET  — returns the list of headings parsed from the article HTML so the
 *         client can render an "insert after which section?" picker.
 *
 * POST — inserts the image into the article HTML.
 *   body: { afterHeadingIndex: number | null }
 *   - null / -1  → replace existing placeholder (placementKey match) or prepend at top
 *   - 0..N       → insert after the Nth heading tag (h1-h4) in the document
 */

function parseHeadings(html) {
  const headings = [];
  const re = /<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  let idx = 0;
  while ((m = re.exec(html)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text) headings.push({ index: idx, tag: m[1], text, matchIndex: m.index });
    idx++;
  }
  return headings;
}

/**
 * Insert imgHtml right after the closing tag of the heading at position `headingIndex`
 * in the source HTML string.
 */
function insertAfterHeading(html, headingIndex, imgHtml) {
  const re = /<(h[1-4])[^>]*>[\s\S]*?<\/\1>/gi;
  let m;
  let idx = 0;
  while ((m = re.exec(html)) !== null) {
    if (idx === headingIndex) {
      const insertAt = m.index + m[0].length;
      return html.slice(0, insertAt) + '\n' + imgHtml + '\n' + html.slice(insertAt);
    }
    idx++;
  }
  // Heading not found — prepend
  return imgHtml + '\n' + html;
}

export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });

    const { id: articleId } = await params;
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { content: true } });
    if (!article?.content || article.content.type !== 'html') {
      return NextResponse.json({ headings: [] });
    }
    return NextResponse.json({ headings: parseHeadings(article.content.html) });
  } catch (e) {
    console.error('[insert GET]', e);
    return NextResponse.json({ message: 'Failed to parse headings' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });

    const { id: articleId, assetId } = await params;
    const body = await req.json().catch(() => ({}));
    const afterHeadingIndex = body?.afterHeadingIndex ?? null;

    const [article, asset] = await Promise.all([
      prisma.article.findUnique({ where: { id: articleId }, select: { content: true, featuredImage: true } }),
      prisma.articleAssetRequest.findUnique({ where: { id: assetId }, select: { imageUrl: true, placementKey: true, prompt: true } }),
    ]);

    if (!article) return NextResponse.json({ message: 'Article not found' }, { status: 404 });
    if (!asset) return NextResponse.json({ message: 'Asset not found' }, { status: 404 });
    if (!asset.imageUrl) return NextResponse.json({ message: 'Asset has no image yet' }, { status: 400 });

    // Featured image — update the field
    if (asset.placementKey === 'hero-featured') {
      await prisma.article.update({ where: { id: articleId }, data: { featuredImage: asset.imageUrl } });
      return NextResponse.json({ ok: true, article: { featuredImage: asset.imageUrl, content: article.content } });
    }

    const content = article.content;
    if (!content || content.type !== 'html' || typeof content.html !== 'string') {
      return NextResponse.json({ message: 'Article content is not in HTML format' }, { status: 400 });
    }

    const imgTag = `<figure class="article-image-figure"><img src="${asset.imageUrl}" alt="${asset.prompt ?? asset.placementKey}" class="article-image" /></figure>`;

    let updatedHtml = content.html;

    // 1. Always try placeholder replacement first
    const escaped = asset.placementKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const placeholderRe = new RegExp(`<div[^>]*data-placement-key="${escaped}"[^>]*>\\s*</div>`, 'gi');
    if (placeholderRe.test(updatedHtml)) {
      updatedHtml = updatedHtml.replace(
        new RegExp(`<div[^>]*data-placement-key="${escaped}"[^>]*>\\s*</div>`, 'gi'),
        imgTag,
      );
    } else if (afterHeadingIndex !== null && afterHeadingIndex >= 0) {
      // 2. Insert after the chosen heading
      updatedHtml = insertAfterHeading(updatedHtml, afterHeadingIndex, imgTag);
    } else {
      // 3. Prepend (no heading chosen, no placeholder)
      updatedHtml = imgTag + '\n' + updatedHtml;
    }

    const updatedContent = { ...content, html: updatedHtml };
    await prisma.article.update({ where: { id: articleId }, data: { content: updatedContent } });

    return NextResponse.json({ ok: true, article: { content: updatedContent, featuredImage: article.featuredImage } });
  } catch (e) {
    console.error('[insert POST]', e);
    return NextResponse.json({ message: 'Failed to insert image' }, { status: 500 });
  }
}
