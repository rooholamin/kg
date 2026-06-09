import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { updateEngineSettings, ENGINE_IDS } from '@/services/pipeline-engine.service';

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const { type } = await params;
    if (!ENGINE_IDS.includes(type)) {
      return NextResponse.json({ message: `Unknown engine type: ${type}` }, { status: 400 });
    }

    const body = await req.json();
    const delayMinutes = Number(body.delayMinutes);
    if (isNaN(delayMinutes)) {
      return NextResponse.json({ message: 'delayMinutes must be a number' }, { status: 400 });
    }

    const data = await updateEngineSettings(type, { delayMinutes });
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/pipeline-engine/[type]/settings PATCH]', e);
    return routeError(e, 'Failed to update settings');
  }
}
