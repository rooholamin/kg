import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { createCharacter } from '@/services/higgsfield.service';

/**
 * ADMIN-ONLY. Trains a Higgsfield Soul Character from a section's existing
 * characterImage plus any extra videoRefImageUrls, and stores the returned
 * character ID on Section.videoCharacterId. This is intentionally not
 * something the Video Director Agent can trigger itself — see
 * services/higgsfield.service.js's createCharacter doc comment.
 */
export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const { sectionId } = await params;
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) return NextResponse.json({ message: 'Section not found' }, { status: 404 });

    const referenceImageUrls = [section.characterImage, ...(section.videoRefImageUrls || [])].filter(Boolean);
    if (!referenceImageUrls.length) {
      return NextResponse.json(
        { message: 'Section has no characterImage or videoRefImageUrls to train from' },
        { status: 422 },
      );
    }

    const character = await createCharacter({
      name: `KG Hub — ${section.name}`,
      referenceImageUrls,
    });

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data: { videoCharacterId: character.id },
    });

    return NextResponse.json({ data: updated, character });
  } catch (e) {
    return routeError(e, 'Failed to train video character');
  }
}
