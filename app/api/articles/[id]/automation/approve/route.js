import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { sendToApproval } from '@/services/article-automation.service';

export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    const result = await sendToApproval(id, session.user?.id ?? null);

    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    console.error('[api/articles/:id/automation/approve POST]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to send article to approval' }, { status: 500 });
  }
}
