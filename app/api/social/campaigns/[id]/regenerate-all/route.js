import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { regenerateAllContent } from '@/services/social-pipeline.service';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const instruction = body.instruction || null;

    const count = await prisma.socialPost.count({
      where: { campaignId: id, status: { notIn: ['content_generating', 'scheduled'] } },
    });

    // Run in background — regenerating touches the AI content agent for each
    // post sequentially and can take a while; client polls for status instead.
    regenerateAllContent(id, instruction).catch((err) => console.error('[regenerate-all background]', err));

    return NextResponse.json({ message: 'Regeneration started', count });
  } catch (e) {
    return routeError('[POST /api/social/campaigns/[id]/regenerate-all]', e);
  }
}
