import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { reassemblePost } from '@/services/video-pipeline.service';
import { startBackgroundJob } from '@/lib/background-job';

// ALWAYS a manual, standalone trigger — never auto-run after a segment
// (re)generates. Concatenates every completed segment, mixes in
// duration-matched music, optionally applies Captions.ai, and uploads.
//
// Backgrounded: downloading every clip, running ffmpeg and waiting on
// Captions.ai can outlast the 300s proxy timeout. The client tracks the
// per-step pipeline logs instead.
export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    const post = await prisma.videoPost.findUnique({
      where: { id },
      include: { segments: { select: { status: true, videoUrl: true } } },
    });
    if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    if (!post.segments.some((s) => s.status === 'completed' && s.videoUrl)) {
      return NextResponse.json({ message: 'No completed segments to assemble yet.' }, { status: 422 });
    }

    startBackgroundJob(`reassemble ${id}`, () => reassemblePost(id));

    return NextResponse.json({ started: true }, { status: 202 });
  } catch (e) {
    return routeError(e, 'Failed to re-assemble video');
  }
}
