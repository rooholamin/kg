import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import {
  getCategoryById,
  updateCategory,
  archiveOrDeleteCategory,
} from '@/services/category.service';
import { CategoryFormSchema } from '@/app/(protected)/dashboard/categories/forms/category-schema';

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
        sectionId: row.sectionId,
        section: row.section ?? null,
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
    const parsed = CategoryFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { message: first?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const row = await updateCategory(id, parsed.data, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        sectionId: row.sectionId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (e) {
    console.error('[api/categories/:id PUT]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    if (e?.code === 'DUPLICATE') {
      return NextResponse.json({ message: e.message }, { status: 409 });
    }
    if (e?.code === 'VALIDATION') {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: 'Failed to update category' },
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
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;
    const result = await archiveOrDeleteCategory(id, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({
      data: {
        id: result.id,
        result: result.result,
        alreadyArchived: result.alreadyArchived ?? false,
        message:
          result.result === 'archived' && !result.alreadyArchived
            ? 'Category archived because it has related topics or articles.'
            : result.result === 'archived' && result.alreadyArchived
              ? 'Category is already archived.'
              : 'Category deleted.',
      },
    });
  } catch (e) {
    console.error('[api/categories/:id DELETE]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json(
      { message: 'Failed to delete category' },
      { status: 500 },
    );
  }
}
