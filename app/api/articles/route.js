import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { getArticles, createArticle } from '@/services/article.service';
import { ArticleFormSchema } from '@/app/(protected)/dashboard/articles/forms/article-schema';

function mapArticle(a) {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    content: a.content,
    topicId: a.topicId,
    categoryId: a.categoryId,
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
    const status = searchParams.get('status') || null;
    const approvedBy = searchParams.get('approvedBy') || null;
    const rejectedBy = searchParams.get('rejectedBy') || null;

    const rows = await getArticles({
      topicId: topicId && topicId !== 'all' ? topicId : null,
      categoryId: categoryId && categoryId !== 'all' ? categoryId : null,
      status: status && status !== 'all' ? status : null,
      approvedBySet: approvedBy === 'set',
      rejectedBySet: rejectedBy === 'set',
    });

    const data = rows.map(mapArticle);

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/articles]', e);
    return NextResponse.json(
      { message: 'Failed to load articles' },
      { status: 500 },
    );
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
    return NextResponse.json({ data: mapArticle(row) });
  } catch (e) {
    console.error('[api/articles POST]', e);
    if (e?.code === 'VALIDATION' || e?.code === 'NOT_FOUND') {
      return NextResponse.json(
        { message: e.message },
        { status: e.code === 'NOT_FOUND' ? 404 : 400 },
      );
    }
    return NextResponse.json(
      { message: 'Failed to create article' },
      { status: 500 },
    );
  }
}
