import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getCalendarArticles } from '@/services/article.service';
import { getScheduledSlotsForCalendar } from '@/services/scheduler.service';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const topicId = searchParams.get('topicId') || null;
    const categoryId = searchParams.get('categoryId') || null;
    const status = searchParams.get('status') || null;
    const includeSlots = searchParams.get('includeSlots') === 'true';

    const [articles, slots] = await Promise.all([
      getCalendarArticles({
        topicId: topicId && topicId !== 'all' ? topicId : null,
        categoryId: categoryId && categoryId !== 'all' ? categoryId : null,
        status: status && status !== 'all' ? status : null,
      }),
      includeSlots ? getScheduledSlotsForCalendar() : Promise.resolve([]),
    ]);

    return NextResponse.json({ data: articles, slots });
  } catch (e) {
    console.error('[api/calendar]', e);
    return NextResponse.json(
      { message: 'Failed to load calendar' },
      { status: 500 },
    );
  }
}
