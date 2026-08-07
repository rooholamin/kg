import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

// Drops the post's planner session so the next re-plan opens a fresh one.
//
// A session is pinned to one agent definition for life, so it dies with that
// agent: archiving or replacing the planner leaves every post that used it
// answering "cannot send events to archived sessions" forever. The session is
// also the planner's whole memory, so this doubles as the escape hatch when a
// conversation has drifted somewhere unrecoverable.
//
// The plan itself is deliberately left alone — only the conversation behind it
// is discarded, and nothing here can spend generation credits.
export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const post = await prisma.videoPost.findUnique({
      where: { id },
      select: { id: true, planSessionId: true, status: true },
    });
    if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    if (post.status === 'planning') {
      return NextResponse.json(
        { message: 'The planner is working right now — wait for it to finish before resetting.' },
        { status: 422 },
      );
    }

    await prisma.videoPost.update({
      where: { id },
      data: { planSessionId: null, errorMessage: null },
    });

    return NextResponse.json({ data: { previousSessionId: post.planSessionId } });
  } catch (e) {
    return routeError(e, 'Failed to reset the planner session');
  }
}
