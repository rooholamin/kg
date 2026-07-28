import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { reassemblePost } from '@/services/video-pipeline.service';

// ALWAYS a manual, standalone trigger — never auto-run after a segment
// (re)generates. Concatenates every completed segment, mixes in
// duration-matched music, optionally applies Captions.ai, and uploads.
export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    const result = await reassemblePost(id);

    const updated = await prisma.videoPost.findUnique({
      where: { id },
      include: { segments: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json({ data: updated, result });
  } catch (e) {
    return routeError(e, 'Failed to re-assemble video');
  }
}
