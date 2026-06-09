import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { approveArticle, rejectArticle } from '@/services/article-automation.service';
import { publishArticleToWordPress } from '@/services/wordpress.service';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    // Editors can reject but only admins/superadmins can approve (triggers WP publishing)
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await request.json();
    const { action, notes } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { message: 'action must be "approve" or "reject"' },
        { status: 400 },
      );
    }

    if (action === 'approve') {
      requireRole(session, 'superadmin', 'admin');
    }

    const userId = session.user?.id ?? null;

    if (action === 'reject') {
      await rejectArticle(id, userId, notes ?? null);
      return NextResponse.json({ ok: true, action: 'rejected' });
    }

    // Approve — move to scheduling then fire-and-forget WordPress publish
    await approveArticle(id, userId, notes ?? null);

    // Fire-and-forget: don't await so the response is immediate
    publishArticleToWordPress(id, userId).catch((err) => {
      console.error(`[approval/decision] WP publish failed for article ${id}:`, err);
    });

    return NextResponse.json({ ok: true, action: 'approved' });
  } catch (e) {
    console.error('[api/articles/:id/approval/decision POST]', e);
    return routeError(e, 'Failed to process approval decision');
  }
}
