import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { deleteIdea, updateIdea } from '@/services/idea-backlog.service';

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;
    const body = await request.json();
    const data = await updateIdea(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/idea-backlog/[id] PUT]', error);
    if (error?.code === 'FORBIDDEN') {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error?.code === 'VALIDATION') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to update idea' }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;
    const data = await deleteIdea(id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/idea-backlog/[id] DELETE]', error);
    if (error?.code === 'FORBIDDEN') {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to delete idea' }, { status: 500 });
  }
}
