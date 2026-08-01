import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { createReferenceElement } from '@/services/video-ai.service';

async function getVideoSettings() {
  return prisma.videoSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });
}

/**
 * ADMIN-ONLY. Same training flow as app/api/video/characters/[sectionId]/train
 * — creates a Higgsfield Reference Element from the roster character's
 * referenceImageUrls (via the Character Admin Agent), and stores the
 * returned element ID on VideoCharacter.videoCharacterId. Synchronous, no
 * separate status to poll.
 */
export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;
    const character = await prisma.videoCharacter.findUnique({ where: { id } });
    if (!character) return NextResponse.json({ message: 'Character not found' }, { status: 404 });

    const referenceImageUrls = character.referenceImageUrls || [];
    if (!referenceImageUrls.length) {
      return NextResponse.json(
        { message: 'Character has no reference images to create a Reference Element from' },
        { status: 422 },
      );
    }

    const settings = await getVideoSettings();
    const result = await createReferenceElement({
      sectionName: `KG Hub Custom — ${character.name}`,
      referenceImageUrls,
      settings,
    });

    if (!result.elementId || result.status === 'failed' || result.status === 'nsfw') {
      return NextResponse.json(
        { message: result.errorMessage || `Reference Element creation failed (status: ${result.status || 'unknown'})` },
        { status: 422 },
      );
    }

    const updated = await prisma.videoCharacter.update({
      where: { id },
      data: { videoCharacterId: result.elementId },
    });

    return NextResponse.json({ data: updated, character: { id: result.elementId, status: result.status } });
  } catch (e) {
    console.error('[POST /api/video/characters/roster/[id]/train]', e);
    return routeError(e, e?.message || 'Failed to create video character');
  }
}
