import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import {
  getSectionById,
  updateSection,
  archiveOrDeleteSection,
} from '@/services/section.service';
import { SectionFormSchema } from '@/app/(protected)/dashboard/sections/forms/section-schema';

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
    const row = await getSectionById(id);
    if (!row) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        summary: row.summary,
        icon: row.icon,
        status: row.status,
        characterName: row.characterName,
        characterBiography: row.characterBiography,
        characterPersona: row.characterPersona,
        characterImage: row.characterImage,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        categoryCount: row._count.categories,
        categories: row.categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          status: c.status,
          topicCount: c._count.topics,
          articleCount: c._count.articles,
        })),
      },
    });
  } catch (e) {
    console.error('[api/sections/:id]', e);
    return NextResponse.json(
      { message: 'Failed to load section' },
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

    const { id } = await params;
    const body = await request.json();
    const parsed = SectionFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { message: first?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const row = await updateSection(id, parsed.data, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({
      data: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        summary: row.summary,
        icon: row.icon,
        status: row.status,
        characterName: row.characterName,
        characterBiography: row.characterBiography,
        characterPersona: row.characterPersona,
        characterImage: row.characterImage,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (e) {
    console.error('[api/sections/:id PUT]', e);
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
      { message: 'Failed to update section' },
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

    const { id } = await params;
    const result = await archiveOrDeleteSection(id, {
      createdBy: session.user?.id ?? null,
    });
    return NextResponse.json({
      data: {
        id: result.id,
        result: result.result,
        alreadyArchived: result.alreadyArchived ?? false,
        message:
          result.result === 'archived' && !result.alreadyArchived
            ? 'Section archived because it has related categories.'
            : result.result === 'archived' && result.alreadyArchived
              ? 'Section is already archived.'
              : 'Section deleted.',
      },
    });
  } catch (e) {
    console.error('[api/sections/:id DELETE]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json(
      { message: 'Failed to delete section' },
      { status: 500 },
    );
  }
}
