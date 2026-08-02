import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { continuePost } from '@/services/video-pipeline.service';

// Resumes a shoot that died mid-execution, in the post's existing director
// session. The alternative — re-approving the plan — opens a fresh session and
// reshoots every segment at full cost, even the ones already generated and
// billed on Higgsfield's side.
export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const result = await continuePost(id);

    const updated = await prisma.videoPost.findUnique({
      where: { id },
      include: { segments: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json({ data: updated, result });
  } catch (e) {
    return routeError(e, 'Failed to continue shoot');
  }
}
