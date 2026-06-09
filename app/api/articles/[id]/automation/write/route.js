import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { triggerWriting } from '@/services/article-automation.service';

export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const result = await triggerWriting(id, session.user?.id ?? null);

    return NextResponse.json({
      ok: true,
      article: result.article ?? null,
      assets: result.assets ?? [],
    });
  } catch (e) {
    console.error('[api/articles/:id/automation/write POST]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to trigger writing workflow' }, { status: 500 });
  }
}
