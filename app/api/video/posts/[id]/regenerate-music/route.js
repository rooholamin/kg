import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { regenerateMusic } from '@/services/video-pipeline.service';
import { startBackgroundJob } from '@/lib/background-job';

// Swaps in a fresh background music track without re-touching Higgsfield or
// re-processing segments — reuses the base render from the last Re-assemble.
// Backgrounded like the other render work; progress comes from the logs.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const note = body.note || null;

    const post = await prisma.videoPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 });

    startBackgroundJob(`regenerate-music ${id}`, () => regenerateMusic(id, note));

    return NextResponse.json({ started: true }, { status: 202 });
  } catch (e) {
    return routeError(e, 'Failed to regenerate music');
  }
}
