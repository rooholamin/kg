import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getScheduleBatchDetail } from '@/services/scheduler.service';

export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    const { id } = await params;
    const data = await getScheduleBatchDetail(id);
    if (!data) {
      return NextResponse.json({ message: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/scheduler/batches/[id] GET]', e);
    return NextResponse.json({ message: 'Failed to load batch' }, { status: 500 });
  }
}
