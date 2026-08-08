import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { syncFromAgent } from '@/services/video-pipeline.service';

// Read the agent's last reply and record whatever it finished.
//
// Deliberately NOT a background job: it only reads a session and writes rows,
// so it returns in seconds and the caller gets a real answer about what was
// recovered. Nothing is sent to the agent, so it can never spend or re-trigger
// a generation, which is why it's safe to reach for whenever a post looks
// stuck.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const result = await syncFromAgent(id);

    return NextResponse.json(result);
  } catch (e) {
    return routeError(e, 'Could not read the agent session');
  }
}
