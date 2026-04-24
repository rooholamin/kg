import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getCategories } from '@/services/category.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const rows = await getCategories();
    const data = rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      topicCount: c._count.topics,
      articleCount: c._count.articles,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/categories]', e);
    return NextResponse.json(
      { message: 'Failed to load categories' },
      { status: 500 },
    );
  }
}
