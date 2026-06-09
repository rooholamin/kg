import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { publishArticleToWordPress } from '@/services/wordpress.service';

export async function POST(_request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    const result = await publishArticleToWordPress(id, session.user?.id ?? null);

    if (!result.ok) {
      return NextResponse.json({ message: result.error ?? 'WordPress publish failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    console.error('[api/articles/:id/wordpress/publish POST]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to publish to WordPress' }, { status: 500 });
  }
}
