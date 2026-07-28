import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { listCaptionTemplates } from '@/services/captions-ai.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const templates = await listCaptionTemplates({ limit: 100 });
    return NextResponse.json({ data: templates });
  } catch (e) {
    return routeError(e, 'Failed to load caption templates');
  }
}
