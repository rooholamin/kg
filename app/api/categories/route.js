import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getCategories, createCategory } from '@/services/category.service';
import { CategoryFormSchema } from '@/app/(protected)/dashboard/categories/forms/category-schema';

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
      sectionId: c.sectionId,
      section: c.section ?? null,
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

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = CategoryFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { message: first?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const row = await createCategory(parsed.data, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        sectionId: row.sectionId,
        section: null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        topicCount: 0,
        articleCount: 0,
      },
    });
  } catch (e) {
    console.error('[api/categories POST]', e);
    if (e?.code === 'DUPLICATE') {
      return NextResponse.json({ message: e.message }, { status: 409 });
    }
    if (e?.code === 'VALIDATION') {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: 'Failed to create category' },
      { status: 500 },
    );
  }
}
