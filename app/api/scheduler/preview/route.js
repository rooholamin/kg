import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { previewSchedule } from '@/services/scheduler.service';
import { prisma } from '@/lib/prisma';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const body = await request.json();
    const {
      startDate,
      endDate,
      postsPerDay,
      sectionIds = [],
      categoryIds = [],
      excludeTopicIds = [],
    } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ message: 'Start and end dates are required' }, { status: 400 });
    }
    if (!postsPerDay || postsPerDay < 1) {
      return NextResponse.json({ message: 'Posts per day must be at least 1' }, { status: 400 });
    }
    if (categoryIds.length === 0) {
      return NextResponse.json({ message: 'At least one category is required' }, { status: 400 });
    }

    const slots = await previewSchedule({
      startDate,
      endDate,
      postsPerDay,
      sectionIds,
      categoryIds,
      excludeTopicIds,
    });

    // Enrich with names for display
    const catIds = [...new Set(slots.map((s) => s.categoryId))];
    const topicIds = [...new Set(slots.map((s) => s.topicId))];
    const sectionIdsToLoad = [...new Set(slots.map((s) => s.sectionId).filter(Boolean))];

    const [categories, topics, sections] = await Promise.all([
      prisma.category.findMany({
        where: { id: { in: catIds } },
        select: { id: true, name: true },
      }),
      prisma.topic.findMany({
        where: { id: { in: topicIds } },
        select: { id: true, name: true },
      }),
      sectionIdsToLoad.length > 0
        ? prisma.section.findMany({
            where: { id: { in: sectionIdsToLoad } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const topicMap = Object.fromEntries(topics.map((t) => [t.id, t.name]));
    const sectionMap = Object.fromEntries(sections.map((s) => [s.id, s.name]));

    const enriched = slots.map((s) => ({
      sectionId: s.sectionId,
      sectionName: s.sectionId ? (sectionMap[s.sectionId] ?? null) : null,
      categoryId: s.categoryId,
      categoryName: catMap[s.categoryId] ?? null,
      topicId: s.topicId,
      topicName: topicMap[s.topicId] ?? null,
      scheduledDate: s.scheduledDate,
    }));

    return NextResponse.json({ data: enriched, total: enriched.length });
  } catch (e) {
    console.error('[api/scheduler/preview POST]', e);
    if (e?.code === 'VALIDATION') {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Failed to preview schedule' }, { status: 500 });
  }
}
