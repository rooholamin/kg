import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
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
        characterBackground: row.characterBackground,
        characterRole: row.characterRole,
        characterAge: row.characterAge,
        characterBiography: row.characterBiography,
        characterTone: row.characterTone,
        characterWritingStyle: row.characterWritingStyle,
        characterSampleVoice: row.characterSampleVoice,
        characterPersona: row.characterPersona,
        characterImage: row.characterImage,
        wpSiteUrl: row.wpSiteUrl,
        wpUsername: row.wpUsername,
        wpAppPassword: row.wpAppPassword,
        wpAuthorId: row.wpAuthorId,
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
    return routeError(e, 'Failed to load section');
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
        characterBackground: row.characterBackground,
        characterRole: row.characterRole,
        characterAge: row.characterAge,
        characterBiography: row.characterBiography,
        characterTone: row.characterTone,
        characterWritingStyle: row.characterWritingStyle,
        characterSampleVoice: row.characterSampleVoice,
        characterPersona: row.characterPersona,
        characterImage: row.characterImage,
        wpSiteUrl: row.wpSiteUrl,
        wpUsername: row.wpUsername,
        wpAppPassword: row.wpAppPassword,
        wpAuthorId: row.wpAuthorId,
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
    return routeError(e, 'Failed to update section');
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
    return routeError(e, 'Failed to delete section');
  }
}
