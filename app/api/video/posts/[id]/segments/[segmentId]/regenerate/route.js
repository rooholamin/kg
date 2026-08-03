import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { regenerateSegment } from '@/services/video-pipeline.service';
import { startBackgroundJob } from '@/lib/background-job';

// Redoes exactly ONE segment, reusing the post's existing director session —
// every other segment (and the currently assembled video, if any) is left
// completely untouched. Re-assembly is a separate, manual step afterward.
//
// Runs in the background: a Seedance shoot regularly exceeds the 300s proxy
// timeout, which used to surface as a bogus "Regeneration failed" while the
// segment was in fact still generating and about to succeed. The client
// follows the segment's own status instead.
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
    if (segment.status === 'generating') {
      return NextResponse.json({ message: 'This segment is already generating.' }, { status: 409 });
    }

    // Flip to generating before returning so the very next poll shows the
    // segment as busy, rather than briefly looking idle.
    await prisma.videoSegment.update({
      where: { id: segmentId },
      data: { status: 'generating', errorMessage: null, generationStartedAt: new Date(), generationCompletedAt: null },
    });

    startBackgroundJob(`regenerate-segment ${segmentId}`, () => regenerateSegment(segmentId, note));

    return NextResponse.json({ started: true }, { status: 202 });
  } catch (e) {
    return routeError(e, 'Failed to regenerate segment');
  }
}
