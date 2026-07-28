import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after') || null;

    const logs = await prisma.videoCampaignLog.findMany({
      where: {
        campaignId: id,
        ...(after
          ? {
              createdAt: {
                gt: (
                  await prisma.videoCampaignLog.findUnique({
                    where: { id: after },
                    select: { createdAt: true },
                  })
                )?.createdAt,
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    return NextResponse.json({ data: logs });
  } catch (e) {
    return routeError(e, 'Failed to load campaign logs');
  }
}
