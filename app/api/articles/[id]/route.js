import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import {
  getArticleById,
  updateArticle,
  archiveOrDeleteArticle,
} from '@/services/article.service';
import { ArticleFormSchema } from '@/app/(protected)/dashboard/articles/forms/article-schema';

function mapArticle(a) {
  if (!a) return null;
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

export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const row = await getArticleById(id);
    if (!row) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data: mapArticle(row) });
  } catch (e) {
    console.error('[api/articles/:id]', e);
    return NextResponse.json(
      { message: 'Failed to load article' },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await request.json();
    const parsed = ArticleFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { message: first?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const row = await updateArticle(id, parsed.data, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({ data: mapArticle(row) });
  } catch (e) {
    console.error('[api/articles/:id PUT]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    if (e?.code === 'VALIDATION') {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: 'Failed to update article' },
      { status: 500 },
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const result = await archiveOrDeleteArticle(id, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({
      data: {
        id: result.id,
        deleted: result.deleted,
        message: 'Article permanently deleted.',
      },
    });
  } catch (e) {
    console.error('[api/articles/:id DELETE]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json(
      { message: 'Failed to delete article' },
      { status: 500 },
    );
  }
}
