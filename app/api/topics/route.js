import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { getTopics, createTopic } from '@/services/topic.service';
import { TopicFormSchema } from '@/app/(protected)/dashboard/topics/forms/topic-schema';

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
      wpCategoryId: t.wpCategoryId ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      articleCount: t._count.articles,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/topics]', e);
    return routeError(e, 'Failed to load topics');
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
    requireRole(session, 'superadmin', 'admin');

    const body = await request.json();
    const parsed = TopicFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { message: first?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const row = await createTopic(parsed.data, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        categoryId: row.categoryId,
        categoryName: row.category.name,
        targetKeyword: row.targetKeyword ?? '',
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        articleCount: row._count.articles,
      },
    });
  } catch (e) {
    console.error('[api/topics POST]', e);
    if (e?.code === 'DUPLICATE') {
      return NextResponse.json({ message: e.message }, { status: 409 });
    }
    if (e?.code === 'VALIDATION' || e?.code === 'NOT_FOUND') {
      return NextResponse.json(
        { message: e.message },
        { status: e.code === 'NOT_FOUND' ? 404 : 400 },
      );
    }
    return routeError(e, 'Failed to create topic');
  }
}
