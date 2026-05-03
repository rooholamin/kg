import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireAdmin } from '@/lib/require-admin';
import { deleteReport } from '@/services/project-progress.service';

export async function DELETE(_request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireAdmin(session);

    const { id } = await params;
    const data = await deleteReport(id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/project-progress/reports/:id DELETE]', error);
    if (error?.code === 'FORBIDDEN') {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { message: 'Failed to delete report' },
      { status: 500 },
    );
  }
}

