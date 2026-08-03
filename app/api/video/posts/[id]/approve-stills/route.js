import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { approveStills } from '@/services/video-pipeline.service';
import { startBackgroundJob } from '@/lib/background-job';

// Phase 3a -> Phase 3b: a human looked at every start frame and signed off, so
// the video budget is released. This is the only route that commits it.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const post = await prisma.videoPost.findUnique({
      where: { id },
      include: { segments: { select: { order: true, hasCharacter: true, stillJobId: true } } },
    });
    if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    if (!post.anchorStillJobId) {
      return NextResponse.json(
        { message: 'This post has no start frames yet — approve the plan to generate them first.' },
        { status: 422 },
      );
    }

    const missing = post.segments.filter((s) => !s.hasCharacter && !s.stillJobId).map((s) => s.order);
    if (missing.length) {
      return NextResponse.json(
        { message: `Segment ${missing.join(', ')} has no start frame yet — regenerate it before shooting.` },
        { status: 422 },
      );
    }

    startBackgroundJob(`approve-stills ${id}`, () => approveStills(id, { directorNote: body.directorNote }));

    return NextResponse.json({ started: true }, { status: 202 });
  } catch (e) {
    return routeError(e, 'Failed to start the shoot');
  }
}
