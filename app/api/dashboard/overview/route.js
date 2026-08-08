import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { routeError } from '@/lib/route-error';
import { getDashboardOverview } from '@/services/dashboard.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const data = await getDashboardOverview();
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/dashboard/overview]', e);
    return routeError(e, 'Failed to load dashboard overview');
  }
}
