import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { ProjectBlockerSchema } from '@/app/(protected)/dashboard/project-progress/forms/blocker-schema';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { createBlocker, getBlockers } from '@/services/project-progress.service';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const data = await getBlockers(status);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/project-progress/blockers GET]', error);
    return routeError(e, 'Failed to load blockers');
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const body = await request.json();
    const parsed = ProjectBlockerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const data = await createBlocker(parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/project-progress/blockers POST]', error);
    if (error?.code === 'FORBIDDEN') {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error?.code === 'VALIDATION') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return routeError(e, 'Failed to create blocker');
  }
}

