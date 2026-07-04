import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { retryFailedExports } from '@/services/social-pipeline.service';

export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    const count = await prisma.socialPost.count({ where: { campaignId: id, status: 'failed' } });

    // Run in background — exports are throttled (max 2 concurrent) and can
    // take a while for several posts; client polls for status instead of
    // waiting on this request.
    retryFailedExports(id).catch((err) => console.error('[retry-failed background]', err));

    return NextResponse.json({ message: 'Retry started', count });
  } catch (e) {
    return routeError('[POST /api/social/campaigns/[id]/retry-failed]', e);
  }
}
