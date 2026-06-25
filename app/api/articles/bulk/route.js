import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { archiveOrDeleteArticle } from '@/services/article.service';
import { approveArticle } from '@/services/article-automation.service';
import { publishArticleToWordPress } from '@/services/wordpress.service';

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin', 'editor');

    const body = await request.json();
    const { ids } = body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { message: 'ids must be a non-empty array' },
        { status: 400 },
      );
    }

    const userId = session.user?.id ?? null;
    const results = await Promise.allSettled(
      ids.map((id) => archiveOrDeleteArticle(id, { createdBy: userId })),
    );

    const deleted = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({ data: { deleted, failed, total: ids.length } });
  } catch (e) {
    console.error('[api/articles/bulk DELETE]', e);
    return routeError(e, 'Failed to delete articles');
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const body = await request.json();
    const { action, ids } = body;

    if (action !== 'approve') {
      return NextResponse.json(
        { message: 'action must be "approve"' },
        { status: 400 },
      );
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { message: 'ids must be a non-empty array' },
        { status: 400 },
      );
    }

    const userId = session.user?.id ?? null;
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        await approveArticle(id, userId, null);
        // Fire-and-forget WP publish
        publishArticleToWordPress(id, userId).catch((err) => {
          console.error(`[bulk approve] WP publish failed for article ${id}:`, err);
        });
      }),
    );

    const approved = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({ data: { approved, failed, total: ids.length } });
  } catch (e) {
    console.error('[api/articles/bulk POST]', e);
    return routeError(e, 'Failed to approve articles');
  }
}
