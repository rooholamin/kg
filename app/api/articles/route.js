import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { getArticles, createArticle } from '@/services/article.service';
import { ArticleFormSchema } from '@/app/(protected)/dashboard/articles/forms/article-schema';

function mapArticle(a, { full = false } = {}) {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    ...(full ? { content: a.content } : {}),
    topicId: a.topicId,
    categoryId: a.categoryId,
    sectionId: a.category.sectionId ?? null,
    status: a.status,
    topicName: a.topic.name,
    categoryName: a.category.name,
    targetKeyword: a.topic.targetKeyword ?? null,
    publishDate: a.publishDate,
    readinessDeadline: a.readinessDeadline,
    seoScore: a.seoScore,
    wordpressPostId: a.wordpressPostId,
    approvedById: a.approvedById,
    approvedAt: a.approvedAt,
    rejectedById: a.rejectedById,
    rejectedAt: a.rejectedAt,
    featuredImage: a.featuredImage,
    galleryImages: a.galleryImages,
    videoUrl: a.videoUrl,
    isEditorsChoice: a.isEditorsChoice,
    views: a.views,
    likes: a.likes,
    commentsCount: a.commentsCount,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

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
    const sectionId = searchParams.get('sectionId') || null;
    const status = searchParams.get('status') || null;
    const approvedBy = searchParams.get('approvedBy') || null;
    const rejectedBy = searchParams.get('rejectedBy') || null;
    const publishDateFrom = searchParams.get('publishDateFrom') || null;
    const publishDateTo = searchParams.get('publishDateTo') || null;
    const countOnly = searchParams.get('countOnly') === 'true';
    // List views (700+ rows) only need the lean shape; callers that render
    // full article body (approvals preview, edit-by-id) opt in explicitly.
    const full = searchParams.get('full') === 'true';

    const rows = await getArticles({
      topicId: topicId && topicId !== 'all' ? topicId : null,
      categoryId: categoryId && categoryId !== 'all' ? categoryId : null,
      sectionId: sectionId && sectionId !== 'all' ? sectionId : null,
      status: status && status !== 'all' ? status : null,
      approvedBySet: approvedBy === 'set',
      rejectedBySet: rejectedBy === 'set',
      publishDateFrom,
      publishDateTo,
      includeContent: full,
    });

    if (countOnly) {
      return NextResponse.json({ total: rows.length });
    }

    const data = rows.map((a) => mapArticle(a, { full }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/articles]', e);
    return routeError(e, 'Failed to load articles');
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }
    requireRole(session, 'superadmin', 'admin', 'editor');

    const body = await request.json();
    const parsed = ArticleFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { message: first?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const row = await createArticle(parsed.data, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({ data: mapArticle(row, { full: true }) });
  } catch (e) {
    console.error('[api/articles POST]', e);
    if (e?.code === 'VALIDATION' || e?.code === 'NOT_FOUND') {
      return NextResponse.json(
        { message: e.message },
        { status: e.code === 'NOT_FOUND' ? 404 : 400 },
      );
    }
    return routeError(e, 'Failed to create article');
  }
}
