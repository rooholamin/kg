import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { approvePlan } from '@/services/video-pipeline.service';

// Phase 2 -> Phase 3: approves the (optionally human-edited) draft plan and
// kicks off real Higgsfield generation for every planned segment.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { plan: editedPlan, directorNote } = body;

    const result = await approvePlan(id, { editedPlan, directorNote });

    const updated = await prisma.videoPost.findUnique({
      where: { id },
      include: { segments: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json({ data: updated, result });
  } catch (e) {
    return routeError(e, 'Failed to approve plan');
  }
}
