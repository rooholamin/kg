import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';

/**
 * POST /api/articles/:id/wordpress/sync-image
 * Creates a virtual WP attachment record (DB only, no file upload) for the
 * article's S3 featured image and sets it as the post's featured_media.
 * Requires the kghub-featured-image mu-plugin on the WP server.
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

    const secret = process.env.WP_KGHUB_SECRET;
    if (!secret) {
      return NextResponse.json({ message: 'WP_KGHUB_SECRET not configured' }, { status: 500 });
    }

    const base = section.wpSiteUrl.replace(/\/+$/, '');

    const res = await fetch(`${base}/wp-json/kghub/v1/set-featured-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kghub-Secret': secret,
      },
      body: JSON.stringify({
        post_id: article.wordpressPostId,
        image_url: article.featuredImage,
        title: article.title,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { message: `mu-plugin error: ${body?.message ?? res.statusText}` },
        { status: 502 },
      );
    }

    const body = await res.json();
    return NextResponse.json({
      ok: true,
      attachment_id: body.attachment_id,
      message: body.note ?? 'Featured image synced successfully.',
    });
  } catch (e) {
    console.error('[api/articles/:id/wordpress/sync-image POST]', e);
    return routeError(e, 'Failed to sync featured image');
  }
}
