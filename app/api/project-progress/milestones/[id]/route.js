import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { ProjectMilestoneSchema } from '@/app/(protected)/dashboard/project-progress/forms/milestone-schema';
import { requireRole } from '@/lib/require-role';
import {
  deleteMilestone,
  updateMilestone,
} from '@/services/project-progress.service';

function handleError(error, fallbackMessage) {
  if (error?.code === 'FORBIDDEN') {
    return NextResponse.json({ message: error.message }, { status: 403 });
  }
  if (error?.code === 'NOT_FOUND') {
    return NextResponse.json({ message: error.message }, { status: 404 });
  }
  if (error?.code === 'VALIDATION') {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  return NextResponse.json({ message: fallbackMessage }, { status: 500 });
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;
    const body = await request.json();
    const parsed = ProjectMilestoneSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    }
    const data = await updateMilestone(id, parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/project-progress/milestones/:id PUT]', error);
    return handleError(error, 'Failed to update milestone');
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
    const data = await deleteMilestone(id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/project-progress/milestones/:id DELETE]', error);
    return handleError(error, 'Failed to delete milestone');
  }
}

