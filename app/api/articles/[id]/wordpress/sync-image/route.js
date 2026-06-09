import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/require-role';

function basicAuth(username, appPassword) {
  return 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');
}

/**
 * POST /api/articles/:id/wordpress/sync-image
 * Re-sends the FIFU featured image meta to an already-published WordPress post.
 * This triggers a second save_post cycle so FIFU registers the image for
 * homepage/archive templates.
 */
export async function POST(_request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        category: { include: { section: true } },
        topic: { include: { category: { include: { section: true } } } },
      },
    });

    if (!article) {
      return NextResponse.json({ message: 'Article not found' }, { status: 404 });
    }

    if (!article.wordpressPostId) {
      return NextResponse.json({ message: 'Article has not been published to WordPress yet' }, { status: 400 });
    }

    if (!article.featuredImage) {
      return NextResponse.json({ message: 'Article has no featured image' }, { status: 400 });
    }

    const section = article.category?.section ?? article.topic?.category?.section;
    if (!section?.wpSiteUrl || !section?.wpUsername || !section?.wpAppPassword) {
      return NextResponse.json({ message: 'Section has no WordPress credentials configured' }, { status: 400 });
    }

    const base = section.wpSiteUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/wp-json/wp/v2/posts/${article.wordpressPostId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(section.wpUsername, section.wpAppPassword),
      },
      body: JSON.stringify({
        meta: {
          fifu_image_url: article.featuredImage,
          fifu_image_alt: article.title,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { message: `WordPress API error: ${body?.message ?? res.statusText}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, message: 'Featured image synced to WordPress.' });
  } catch (e) {
    console.error('[api/articles/:id/wordpress/sync-image POST]', e);
    return NextResponse.json({ message: 'Failed to sync featured image' }, { status: 500 });
  }
}
