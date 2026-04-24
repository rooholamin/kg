import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTopics } from '@/services/topic.service';

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
    const categoryId = searchParams.get('categoryId') || null;

    const rows = await getTopics(
      categoryId && categoryId !== 'all' ? { categoryId } : {},
    );

    const data = rows.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      categoryId: t.categoryId,
      categoryName: t.category.name,
      targetKeyword: t.targetKeyword ?? '',
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      articleCount: t._count.articles,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/topics]', e);
    return NextResponse.json(
      { message: 'Failed to load topics' },
      { status: 500 },
    );
  }
}
