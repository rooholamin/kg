import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { createIdea, getIdeas } from '@/services/idea-backlog.service';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const priority = searchParams.get('priority') || 'all';

    const data = await getIdeas({ status, priority });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/idea-backlog GET]', error);
    return routeError(e, 'Failed to load idea backlog');
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const body = await request.json();
    const data = await createIdea(body);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/idea-backlog POST]', error);
    if (error?.code === 'FORBIDDEN') {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error?.code === 'VALIDATION') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return routeError(e, 'Failed to create idea');
  }
}
