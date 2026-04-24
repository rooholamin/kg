import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getArticles } from '@/services/article.service';

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

    const rows = await getArticles({
      topicId: topicId && topicId !== 'all' ? topicId : null,
      categoryId: categoryId && categoryId !== 'all' ? categoryId : null,
      status: status && status !== 'all' ? status : null,
    });

    const data = rows.map((a) => ({
      id: a.id,
      title: a.title,
      topicId: a.topicId,
      categoryId: a.categoryId,
      status: a.status,
      topicName: a.topic.name,
      categoryName: a.category.name,
      publishDate: a.publishDate,
      readinessDeadline: a.readinessDeadline,
      seoScore: a.seoScore,
      wordpressPostId: a.wordpressPostId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/articles]', e);
    return NextResponse.json(
      { message: 'Failed to load articles' },
      { status: 500 },
    );
  }
}
