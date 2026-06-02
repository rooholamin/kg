import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';

/** PATCH /api/articles/:id/content — update only the content field */
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });

    const { id } = await params;
    const { content } = await req.json();
    if (!content) return NextResponse.json({ message: 'content is required' }, { status: 400 });

    await prisma.article.update({ where: { id }, data: { content } });

    return NextResponse.json({ ok: true, content });
  } catch (e) {
    console.error('[api/articles/:id/content PATCH]', e);
    return NextResponse.json({ message: 'Failed to update content' }, { status: 500 });
  }
}
