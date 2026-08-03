import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { regenerateStill } from '@/services/video-pipeline.service';
import { startBackgroundJob } from '@/lib/background-job';

// Redo one rejected start frame. Cheap compared to the clip it would have
// produced, which is the entire reason the gate exists.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const target = body.target === 'anchor' ? 'anchor' : 'segment';
    const order = target === 'segment' ? Number(body.order) : null;

    if (target === 'segment' && !Number.isInteger(order)) {
      return NextResponse.json({ message: 'order is required when regenerating a segment still' }, { status: 400 });
    }

    const post = await prisma.videoPost.findUnique({ where: { id }, select: { directorSessionId: true } });
    if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    if (!post.directorSessionId) {
      return NextResponse.json(
        { message: 'This post has no director session — approve the plan to generate its start frames first.' },
        { status: 422 },
      );
    }

    startBackgroundJob(`regenerate-still ${id} ${target}${order ?? ''}`, () =>
      regenerateStill(id, { target, order, note: body.note?.trim() || null }),
    );

    return NextResponse.json({ started: true }, { status: 202 });
  } catch (e) {
    return routeError(e, 'Failed to regenerate still');
  }
}
