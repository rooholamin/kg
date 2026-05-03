import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { ProjectProgressReportSchema } from '@/app/(protected)/dashboard/project-progress/forms/report-schema';
import { requireAdmin } from '@/lib/require-admin';
import { createReport, getReports } from '@/services/project-progress.service';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitRaw = Number.parseInt(searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20;
    const data = await getReports(limit);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/project-progress/reports GET]', error);
    return NextResponse.json(
      { message: 'Failed to load reports' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireAdmin(session);

    const body = await request.json();
    const parsed = ProjectProgressReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const data = await createReport(parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[api/project-progress/reports POST]', error);
    if (error?.code === 'FORBIDDEN') {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error?.code === 'VALIDATION') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: 'Failed to create report' },
      { status: 500 },
    );
  }
}

