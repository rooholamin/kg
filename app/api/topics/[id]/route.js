import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTopicById } from '@/services/topic.service';

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
    const row = await getTopicById(id);
    if (!row) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        categoryId: row.categoryId,
        categoryName: row.category.name,
        targetKeyword: row.targetKeyword,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        articles: row.articles.map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          publishDate: a.publishDate,
        })),
      },
    });
  } catch (e) {
    console.error('[api/topics/:id]', e);
    return NextResponse.json(
      { message: 'Failed to load topic' },
      { status: 500 },
    );
  }
}
