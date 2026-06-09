import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { triggerAssets } from '@/services/article-automation.service';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id, assetId } = await params;
    let prompt;
    try {
      const body = await req.json();
      prompt = body?.prompt;
    } catch { /* no body */ }

    await triggerAssets(id, session.user?.id ?? null, { assetId, prompt });

    // Fetch the fresh asset + article content so the client can update in-place
    const [asset, articleData] = await Promise.all([
      prisma.articleAssetRequest.findUnique({
        where: { id: assetId },
        include: { history: { orderBy: { version: 'asc' } } },
      }),
      prisma.article.findUnique({
        where: { id },
        select: { content: true, featuredImage: true },
      }),
    ]);

    return NextResponse.json({ ok: true, asset, article: articleData });
  } catch (e) {
    console.error('[api/articles/:id/automation/assets/:assetId POST]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to regenerate asset' }, { status: 500 });
  }
}
