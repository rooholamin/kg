import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { continuePost } from '@/services/video-pipeline.service';
import { startBackgroundJob } from '@/lib/background-job';

// Resumes a shoot that died mid-execution, in the post's existing director
// session. The alternative — re-approving the plan — opens a fresh session and
// reshoots every segment at full cost, even the ones already generated and
// billed on Higgsfield's side.
//
// Preconditions are checked inline so a pointless continue fails fast with a
// useful message; the shoot itself runs in the background, past the 300s proxy
// timeout.
export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const post = await prisma.videoPost.findUnique({
      where: { id },
      include: { segments: { select: { videoUrl: true } } },
    });
    if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    if (!post.directorSessionId) {
      return NextResponse.json(
        { message: 'This post has no director session to continue — approve the plan to start the shoot.' },
        { status: 422 },
      );
    }
    if (!post.segments.some((s) => !s.videoUrl)) {
      return NextResponse.json({ message: 'Every segment already has a clip — nothing to continue.' }, { status: 422 });
    }

    startBackgroundJob(`continue ${id}`, () => continuePost(id));

    return NextResponse.json({ started: true }, { status: 202 });
  } catch (e) {
    return routeError(e, 'Failed to continue shoot');
  }
}
