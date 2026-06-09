import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.pipelineEngineLog.findMany({
        orderBy: { startedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          article: {
            select: {
              title: true,
              category: { select: { name: true } },
            },
          },
        },
      }),
      prisma.pipelineEngineLog.count(),
    ]);

    return NextResponse.json({ data: items, total, page, pageSize });
  } catch (e) {
    console.error('[api/pipeline-engine/history GET]', e);
    return NextResponse.json({ message: 'Failed to load history' }, { status: 500 });
  }
}
