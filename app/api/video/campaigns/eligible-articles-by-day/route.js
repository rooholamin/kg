import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { videoArticleEligibilityWhere } from '@/services/video-pipeline.service';

// Powers the manual day-by-day article picker shown during video campaign
// creation. Not campaign-scoped — the campaign doesn't exist yet while this
// wizard runs. Groups eligible articles by the calendar day of their
// publishDate, most recent day first, paginated via a `before` cursor.
//
// To avoid ever returning a day whose articles are split across a page
// boundary, the batch only returns days it's certain are complete: if the
// fetch came back full (there may be more before the cutoff), the earliest
// (last) day group in the batch is dropped and re-fetched fully on the next
// page instead.
const BATCH_SIZE = 300;

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { searchParams } = new URL(req.url);
    const editorsChoiceOnly = searchParams.get('editorsChoiceOnly') === 'true';
    const includeSectionsParam = searchParams.get('includeSections');
    const includeSections = includeSectionsParam ? includeSectionsParam.split(',').filter(Boolean) : [];
    const before = searchParams.get('before');

    const where = {
      ...videoArticleEligibilityWhere({ editorsChoiceOnly, includeSections }),
      publishDate: { not: null, ...(before ? { lt: new Date(before) } : {}) },
    };

    const articles = await prisma.article.findMany({
      where,
      select: {
        id: true,
        title: true,
        publishDate: true,
        category: { select: { name: true, section: { select: { name: true, slug: true } } } },
      },
      orderBy: { publishDate: 'desc' },
      take: BATCH_SIZE,
    });

    const dayOrder = [];
    const byDay = new Map();
    for (const a of articles) {
      const day = new Date(a.publishDate).toISOString().slice(0, 10);
      if (!byDay.has(day)) {
        byDay.set(day, []);
        dayOrder.push(day);
      }
      byDay.get(day).push({
        id: a.id,
        title: a.title,
        publishDate: a.publishDate,
        sectionName: a.category?.section?.name || null,
        categoryName: a.category?.name || null,
      });
    }

    const batchFull = articles.length === BATCH_SIZE;
    let nextBefore = null;
    if (batchFull && dayOrder.length > 1) {
      // Drop the last (earliest) day — it may be incomplete — and re-fetch
      // it fully on the next page.
      const incompleteDay = dayOrder.pop();
      nextBefore = `${incompleteDay}T00:00:00.000Z`;
      byDay.delete(incompleteDay);
    } else if (batchFull && dayOrder.length === 1) {
      // A single day filled the whole batch — can't safely paginate further
      // back from here without risking splitting it; report no more pages.
      nextBefore = null;
    }

    const days = dayOrder.map((day) => ({ day, articles: byDay.get(day) }));

    return NextResponse.json({ data: { days, nextBefore, hasMore: Boolean(nextBefore) } });
  } catch (e) {
    return routeError(e, 'Failed to load eligible articles');
  }
}
