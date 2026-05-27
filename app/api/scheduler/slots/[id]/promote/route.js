import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { promoteSlotToArticle } from '@/services/scheduler.service';

export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    const article = await promoteSlotToArticle(id, { createdBy: session.user?.id ?? null });
    return NextResponse.json({ data: { articleId: article.id, title: article.title } });
  } catch (e) {
    console.error('[api/scheduler/slots/:id/promote]', e);
    if (e?.code === 'NOT_FOUND') return NextResponse.json({ message: e.message }, { status: 404 });
    if (e?.code === 'VALIDATION') return NextResponse.json({ message: e.message }, { status: 400 });
    return NextResponse.json({ message: 'Failed to promote slot' }, { status: 500 });
  }
}
