import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { retryFailedExports } from '@/services/video-pipeline.service';

export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const count = await prisma.videoPost.count({ where: { campaignId: id, status: 'failed', videoUrl: { not: null } } });

    retryFailedExports(id).catch((err) => console.error('[video retry-failed background]', err));

    return NextResponse.json({ message: 'Retry started', count });
  } catch (e) {
    return routeError(e, 'Failed to retry exports');
  }
}
