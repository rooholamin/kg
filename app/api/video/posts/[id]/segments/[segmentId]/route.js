import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { recordSegmentVersion } from '@/lib/video-segment-versions';

// Sets a segment's clip by hand. The escape hatch for when a clip exists on
// Higgsfield but the pipeline never recorded it — e.g. a director session that
// died after requesting the jobs — so a post can be finished without paying to
// shoot it again. The pasted URL is filed as a new version like any other take.
// Also takes `{ excluded }` on its own to drop a shot from the cut or put it back.
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id, segmentId } = await params;
    const body = await req.json().catch(() => ({}));

    const segment = await prisma.videoSegment.findUnique({ where: { id: segmentId } });
    if (!segment || segment.postId !== id) {
      return NextResponse.json({ message: 'Segment not found on this post' }, { status: 404 });
    }

    // Dropping a shot from the cut is a separate, free edit from attaching a
    // clip: it changes nothing about the take, so it records no new version.
    if (typeof body.excluded === 'boolean' && body.videoUrl === undefined) {
      const updated = await prisma.videoSegment.update({
        where: { id: segmentId },
        data: { excluded: body.excluded },
        include: { versions: { orderBy: { version: 'desc' } } },
      });
      return NextResponse.json({ data: updated });
    }

    const videoUrl = body.videoUrl?.trim();
    if (!videoUrl) return NextResponse.json({ message: 'videoUrl is required' }, { status: 400 });
    if (!/^https?:\/\//i.test(videoUrl)) {
      return NextResponse.json({ message: 'videoUrl must be an http(s) URL' }, { status: 400 });
    }

    const duration = body.duration == null || body.duration === '' ? null : Number(body.duration);
    if (duration != null && (!Number.isFinite(duration) || duration <= 0)) {
      return NextResponse.json({ message: 'duration must be a positive number of seconds' }, { status: 400 });
    }

    await recordSegmentVersion(segmentId, {
      videoUrl,
      duration,
      higgsfieldJobId: body.higgsfieldJobId?.trim() || null,
      // Manually attached clips carry no rate-card estimate — the spend, if any,
      // already happened outside this pipeline and isn't ours to guess at.
      estimatedCost: null,
      source: 'manual',
      note: body.note?.trim() || null,
    });

    const updated = await prisma.videoSegment.update({
      where: { id: segmentId },
      data: {
        videoUrl,
        duration,
        higgsfieldJobId: body.higgsfieldJobId?.trim() || null,
        estimatedCost: null,
        status: 'completed',
        errorMessage: null,
        generationCompletedAt: new Date(),
      },
      include: { versions: { orderBy: { version: 'desc' } } },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    return routeError(e, 'Failed to update segment');
  }
}
