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
 * ADMIN-ONLY. Creates a Higgsfield Reference Element from a section's
 * existing characterImage plus any extra videoRefImageUrls (via the
 * Character Admin Agent, MCP-based — see video-character-admin-agent.yaml),
 * and stores the returned element ID on Section.videoCharacterId. This whole
 * call is synchronous (media_import_url + show_reference_elements both
 * resolve inline), so unlike the old Soul Character training flow there is
 * no separate async status to poll — the response here is final.
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
        { message: 'Section has no characterImage or videoRefImageUrls to create a Reference Element from' },
        { status: 422 },
      );
    }

    const settings = await getVideoSettings();
    const result = await createReferenceElement({
      sectionName: `KG Hub — ${section.name}`,
      referenceImageUrls,
      settings,
    });

    if (!result.elementId || result.status === 'failed' || result.status === 'nsfw') {
      return NextResponse.json(
        { message: result.errorMessage || `Reference Element creation failed (status: ${result.status || 'unknown'})` },
        { status: 422 },
      );
    }

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data: { videoCharacterId: result.elementId },
    });

    return NextResponse.json({ data: updated, character: { id: result.elementId, status: result.status } });
  } catch (e) {
    console.error('[POST /api/video/characters/[sectionId]/train]', e);
    return routeError(e, e?.message || 'Failed to create video character');
  }
}
