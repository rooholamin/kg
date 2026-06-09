import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { getTopicById, updateTopic, archiveOrDeleteTopic } from '@/services/topic.service';
import { TopicFormSchema } from '@/app/(protected)/dashboard/topics/forms/topic-schema';

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
        articleCount: row._count?.articles ?? row.articles?.length ?? 0,
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
    return routeError(e, 'Failed to load topic');
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
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;
    const body = await request.json();
    const parsed = TopicFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { message: first?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const row = await updateTopic(id, parsed.data, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        categoryId: row.categoryId,
        categoryName: row.category.name,
        status: row.status,
        targetKeyword: row.targetKeyword,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        articleCount: row._count.articles,
      },
    });
  } catch (e) {
    console.error('[api/topics/:id PUT]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    if (e?.code === 'DUPLICATE') {
      return NextResponse.json({ message: e.message }, { status: 409 });
    }
    if (e?.code === 'VALIDATION') {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    return routeError(e, 'Failed to update topic');
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
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;
    const result = await archiveOrDeleteTopic(id, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({
      data: {
        id: result.id,
        result: result.result,
        alreadyArchived: result.alreadyArchived ?? false,
        message:
          result.result === 'archived' && !result.alreadyArchived
            ? 'Topic archived because it has related articles.'
            : result.result === 'archived' && result.alreadyArchived
              ? 'Topic is already archived.'
              : 'Topic deleted.',
      },
    });
  } catch (e) {
    console.error('[api/topics/:id DELETE]', e);
    return routeError(e, 'Failed to delete topic');
  }
}
