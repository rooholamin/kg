import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';
import { triggerAssets } from '@/services/article-automation.service';

export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    await triggerAssets(id, session.user?.id ?? null);

    // Re-fetch fresh article content + all assets so the client can update in-place
    const [articleData, assets] = await Promise.all([
      prisma.article.findUnique({
        where: { id },
        select: { content: true, featuredImage: true },
      }),
      prisma.articleAssetRequest.findMany({
        where: { articleId: id },
        orderBy: { createdAt: 'asc' },
        include: { history: { orderBy: { version: 'asc' } } },
      }),
    ]);

    return NextResponse.json({ ok: true, assets, article: articleData });
  } catch (e) {
    console.error('[api/articles/:id/automation/assets/run POST]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to trigger asset generation' }, { status: 500 });
  }
}
