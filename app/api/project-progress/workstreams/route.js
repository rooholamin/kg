import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { ProjectWorkstreamSchema } from '@/app/(protected)/dashboard/project-progress/forms/workstream-schema';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { createWorkstream } from '@/services/project-progress.service';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const body = await request.json();
    const parsed = ProjectWorkstreamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const data = await createWorkstream(parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/project-progress/workstreams POST]', error);
    if (error?.code === 'FORBIDDEN') {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error?.code === 'VALIDATION') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return routeError(e, 'Failed to create workstream');
  }
}

