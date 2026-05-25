import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getSections, createSection } from '@/services/section.service';
import { SectionFormSchema } from '@/app/(protected)/dashboard/sections/forms/section-schema';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const rows = await getSections();
    const data = rows.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      summary: s.summary,
      icon: s.icon,
      status: s.status,
      characterName: s.characterName,
      characterBiography: s.characterBiography,
      characterPersona: s.characterPersona,
      characterImage: s.characterImage,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      categoryCount: s._count.categories,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/sections]', e);
    return NextResponse.json(
      { message: 'Failed to load sections' },
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
    const parsed = SectionFormSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { message: first?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const row = await createSection(parsed.data, {
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
        categoryCount: 0,
      },
    });
  } catch (e) {
    console.error('[api/sections POST]', e);
    if (e?.code === 'DUPLICATE') {
      return NextResponse.json({ message: e.message }, { status: 409 });
    }
    if (e?.code === 'VALIDATION') {
      return NextResponse.json({ message: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: 'Failed to create section' },
      { status: 500 },
    );
  }
}
