import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { approvePlan } from '@/services/video-pipeline.service';
import { startBackgroundJob } from '@/lib/background-job';

// Phase 2 -> Phase 3a: approves the (optionally human-edited) draft plan and
// buys the START FRAMES only. Video generation stays locked until a human
// approves those frames (see the approve-stills route).
//
// Still generation outlasts the 300s proxy timeout, so it runs in the
// background and the client polls post status for progress.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { plan: editedPlan, directorNote } = body;

    const post = await prisma.videoPost.findUnique({ where: { id }, select: { id: true, plan: true } });
    if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    if (!post.plan && !editedPlan) {
      return NextResponse.json({ message: 'Post has no draft plan to approve — run planning first.' }, { status: 422 });
    }

    startBackgroundJob(`approve-plan ${id}`, () => approvePlan(id, { editedPlan, directorNote }));

    return NextResponse.json({ started: true }, { status: 202 });
  } catch (e) {
    return routeError(e, 'Failed to approve plan');
  }
}
