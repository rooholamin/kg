import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { restoreSegmentVersion } from '@/lib/video-segment-versions';

// Swaps the segment back to an earlier take. Free and reversible — no
// generation, no spend, and the take being replaced stays in the history.
// Re-assembly is still a separate manual step afterward.
export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id, segmentId, versionId } = await params;

    const segment = await prisma.videoSegment.findUnique({ where: { id: segmentId } });
    if (!segment || segment.postId !== id) {
      return NextResponse.json({ message: 'Segment not found on this post' }, { status: 404 });
    }

    await restoreSegmentVersion(segmentId, versionId);
    const updated = await prisma.videoSegment.findUnique({
      where: { id: segmentId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    return routeError(e, 'Failed to restore segment version');
  }
}
