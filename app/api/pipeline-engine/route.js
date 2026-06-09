import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { getEngineStatus } from '@/services/pipeline-engine.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const data = await getEngineStatus();
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/pipeline-engine GET]', e);
    return NextResponse.json({ message: 'Failed to load engine status' }, { status: 500 });
  }
}
