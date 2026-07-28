import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const environment = await prisma.videoEnvironment.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });

    return NextResponse.json({ data: environment });
  } catch (e) {
    return routeError(e, 'Failed to load video environment');
  }
}

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const body = await req.json();
    const allowed = ['name', 'textDescriptor', 'refImageUrl', 'higgsfieldRefId'];
    const data = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    const environment = await prisma.videoEnvironment.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    });

    return NextResponse.json({ data: environment });
  } catch (e) {
    return routeError(e, 'Failed to update video environment');
  }
}
