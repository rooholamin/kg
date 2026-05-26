import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getScheduleBatches, createScheduleBatch } from '@/services/scheduler.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    const data = await getScheduleBatches();
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/scheduler/batches GET]', e);
    return NextResponse.json({ message: 'Failed to load batches' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      startDate,
      endDate,
      postsPerDay,
      sectionIds = [],
      categoryIds = [],
      excludeTopicIds = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ message: 'Batch name is required' }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ message: 'Start and end dates are required' }, { status: 400 });
    }
    if (!postsPerDay || postsPerDay < 1) {
      return NextResponse.json({ message: 'Posts per day must be at least 1' }, { status: 400 });
    }
    if (categoryIds.length === 0) {
      return NextResponse.json({ message: 'At least one category is required' }, { status: 400 });
    }

    const batch = await createScheduleBatch(
      { name, startDate, endDate, postsPerDay, sectionIds, categoryIds, excludeTopicIds },
      { createdBy: session.user?.id ?? null },
    );

    return NextResponse.json({ data: batch }, { status: 201 });
  } catch (e) {
    console.error('[api/scheduler/batches POST]', e);
    if (e?.code === 'VALIDATION') {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Failed to create batch' }, { status: 500 });
  }
}
