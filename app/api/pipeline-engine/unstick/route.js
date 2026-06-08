import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/pipeline-engine/unstick
 * Body: { articleId: string }
 *
 * Resets a single article's stale automation state so the engine can re-process it:
 * - ArticleAssetRequest rows stuck in 'generating' → 'pending'
 * - ArticleAutomationRun rows stuck in 'running' → 'failed'
 * - If article is in 'research' status (stuck mid-research) → reset to 'planning'
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { articleId } = body;

    if (!articleId) {
      return NextResponse.json({ message: 'articleId is required' }, { status: 400 });
    }

    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (!article) {
      return NextResponse.json({ message: 'Article not found' }, { status: 404 });
    }

    const [resetAssets, failedRuns, articleUpdate] = await Promise.all([
      prisma.articleAssetRequest.updateMany({
        where: { articleId, status: 'generating' },
        data: { status: 'pending' },
      }),
      prisma.articleAutomationRun.updateMany({
        where: { articleId, status: 'running' },
        data: {
          status: 'failed',
          errorMessage: 'Manually unstuck via pipeline engine',
          updatedAt: new Date(),
        },
      }),
      // If stuck mid-research, reset back to planning
      article.status === 'research'
        ? prisma.article.update({ where: { id: articleId }, data: { status: 'planning' } })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      data: {
        articleId,
        resetAssets: resetAssets.count,
        failedRuns: failedRuns.count,
        statusReset: article.status === 'research' ? 'planning' : null,
      },
    });
  } catch (e) {
    console.error('[api/pipeline-engine/unstick POST]', e);
    return NextResponse.json({ message: 'Failed to unstick article' }, { status: 500 });
  }
}
