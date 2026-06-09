import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { getProjectProgressTree } from '@/services/project-progress.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const data = await getProjectProgressTree();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/project-progress]', error);
    return NextResponse.json(
      { message: 'Failed to load project progress' },
      { status: 500 },
    );
  }
}

