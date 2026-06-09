import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { getLogs } from '@/services/content-log.service';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }
    requireRole(session, 'superadmin', 'admin');

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || null;
    const entityType = searchParams.get('entityType') || null;
    const entityId = searchParams.get('entityId') || null;
    const limit = searchParams.get('limit');

    const rows = await getLogs({
      type: type && type !== 'all' ? type : null,
      entityType: entityType && entityType !== 'all' ? entityType : null,
      entityId: entityId && entityId !== 'all' ? entityId : null,
      limit: limit ? Number.parseInt(limit, 10) : 200,
    });

    const userIds = [
      ...new Set(rows.map((r) => r.createdBy).filter(Boolean)),
    ];
    let userMap = {};
    if (userIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });
      userMap = Object.fromEntries(
        users.map((u) => [u.id, u.name?.trim() || u.email || u.id]),
      );
    }

    const data = rows.map((r) => ({
      id: r.id,
      type: r.type,
      action: r.action,
      message: r.message,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      userLabel: r.createdBy ? userMap[r.createdBy] ?? null : null,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/logs]', e);
    return NextResponse.json(
      { message: 'Failed to load logs' },
      { status: 500 },
    );
  }
}
