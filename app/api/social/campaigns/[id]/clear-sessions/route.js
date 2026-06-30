import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/social/campaigns/[id]/clear-sessions
 *
 * Clears socialContentSessionId from every article that has a post in this
 * campaign. This forces the AI content agent to start a fresh session the
 * next time content is generated or regenerated for those articles.
 */
export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    const campaign = await prisma.socialCampaign.findUnique({
      where: { id },
      include: {
        posts: { select: { articleId: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 });
    }

    const articleIds = [...new Set(campaign.posts.map((p) => p.articleId))];

    if (articleIds.length === 0) {
      return NextResponse.json({ message: 'No articles to clear', cleared: 0 });
    }

    const { count } = await prisma.article.updateMany({
      where: {
        id: { in: articleIds },
        socialContentSessionId: { not: null },
      },
      data: { socialContentSessionId: null },
    });

    return NextResponse.json({
      message: `Cleared sessions for ${count} article${count !== 1 ? 's' : ''}`,
      cleared: count,
    });
  } catch (e) {
    return routeError('[POST /api/social/campaigns/[id]/clear-sessions]', e);
  }
}
