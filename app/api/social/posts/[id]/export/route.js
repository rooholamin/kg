import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { runExport } from '@/services/social-pipeline.service';

export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    // Run in background — client polls for status
    runExport(id).catch((err) => console.error('[export background]', err));

    return NextResponse.json({ message: 'Export started' });
  } catch (e) {
    return routeError('[POST /api/social/posts/[id]/export]', e);
  }
}
