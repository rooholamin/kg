import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { regenerateAllContent } from '@/services/video-pipeline.service';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const directorNote = body.directorNote || body.instruction || null;

    const count = await prisma.videoPost.count({
      where: { campaignId: id, status: { notIn: ['directing', 'scheduled'] } },
    });

    regenerateAllContent(id, directorNote).catch((err) => console.error('[video regenerate-all background]', err));

    return NextResponse.json({ message: 'Regeneration started', count });
  } catch (e) {
    return routeError(e, 'Failed to start regeneration');
  }
}
