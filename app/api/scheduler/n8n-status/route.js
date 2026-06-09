import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { checkN8nHealth } from '@/services/scheduler.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');
    const result = await checkN8nHealth();
    return NextResponse.json(result);
  } catch (e) {
    console.error('[api/scheduler/n8n-status]', e);
    return NextResponse.json({ available: false, error: 'Internal error' }, { status: 500 });
  }
}
