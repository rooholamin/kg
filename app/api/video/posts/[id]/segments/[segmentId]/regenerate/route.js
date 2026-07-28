import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { regenerateSegment } from '@/services/video-pipeline.service';

// Redoes exactly ONE segment, reusing the post's existing director session —
// every other segment (and the currently assembled video, if any) is left
// completely untouched. Re-assembly is a separate, manual step afterward.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id, segmentId } = await params;
    const body = await req.json().catch(() => ({}));
    const note = body.note || body.directorNote || null;

    const segment = await prisma.videoSegment.findUnique({ where: { id: segmentId } });
    if (!segment || segment.postId !== id) {
      return NextResponse.json({ message: 'Segment not found on this post' }, { status: 404 });
    }

    const updated = await regenerateSegment(segmentId, note);
    return NextResponse.json({ data: updated });
  } catch (e) {
    return routeError(e, 'Failed to regenerate segment');
  }
}
