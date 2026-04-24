import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getCategoryById } from '@/services/category.service';

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
    const row = await getCategoryById(id);
    if (!row) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        topicCount: row._count.topics,
        articleCount: row._count.articles,
        topics: row.topics.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          status: t.status,
          targetKeyword: t.targetKeyword,
        })),
      },
    });
  } catch (e) {
    console.error('[api/categories/:id]', e);
    return NextResponse.json(
      { message: 'Failed to load category' },
      { status: 500 },
    );
  }
}
