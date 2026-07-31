import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { resetScheduleBatch } from '@/services/scheduler.service';

export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');
    const { id } = await params;
    const result = await resetScheduleBatch(id, { createdBy: session.user?.id ?? null });
    return NextResponse.json({ data: result });
  } catch (e) {
    console.error('[api/scheduler/batches/[id]/reset POST]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to reset batch' }, { status: 500 });
  }
}
