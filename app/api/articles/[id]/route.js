import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getArticleById } from '@/services/article.service';

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

    return NextResponse.json({
      data: {
        id: row.id,
        title: row.title,
        topicId: row.topicId,
        categoryId: row.categoryId,
        status: row.status,
        topicName: row.topic.name,
        categoryName: row.category.name,
        publishDate: row.publishDate,
        readinessDeadline: row.readinessDeadline,
        seoScore: row.seoScore,
        wordpressPostId: row.wordpressPostId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (e) {
    console.error('[api/articles/:id]', e);
    return NextResponse.json(
      { message: 'Failed to load article' },
      { status: 500 },
    );
  }
}
