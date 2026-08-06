import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { startEngine, ENGINE_IDS } from '@/services/pipeline-engine.service';
import { checkN8nHealth } from '@/services/scheduler.service';

// Only research/writing/images actually depend on n8n being reachable — the
// two SEO engines talk to Anthropic Managed Agents exclusively, so an n8n
// outage shouldn't block starting them.
const N8N_DEPENDENT_ENGINES = new Set(['research', 'writing', 'images']);

export async function POST(req, { params }) {
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

    if (N8N_DEPENDENT_ENGINES.has(type)) {
      const health = await checkN8nHealth();
      if (!health.available) {
        return NextResponse.json(
          { message: `AI Agent is not available: ${health.error}` },
          { status: 400 },
        );
      }
    }

    const data = await startEngine(type, session.user?.id ?? null);
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/pipeline-engine/[type]/start POST]', e);
    return routeError(e, 'Failed to start engine');
  }
}
