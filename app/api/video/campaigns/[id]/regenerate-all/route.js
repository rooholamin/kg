import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { rePlanAllPosts } from '@/services/video-pipeline.service';

// Bulk re-DRAFT only (Phase 1, no Higgsfield spend) — posts already approved/
// executing/scheduled are left untouched. Re-executing an approved post in
// bulk would re-spend real generation credits, which defeats the point of
// per-post plan approval.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const directorNote = body.directorNote || body.instruction || null;

    const count = await prisma.videoPost.count({
      where: { campaignId: id, status: { in: ['pending', 'plan_ready', 'failed'] } },
    });

    rePlanAllPosts(id, directorNote).catch((err) => console.error('[video replan-all background]', err));

    return NextResponse.json({ message: 'Re-planning started', count });
  } catch (e) {
    return routeError(e, 'Failed to start re-planning');
  }
}
