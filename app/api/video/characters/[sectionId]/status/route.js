import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { getCharacterStatus } from '@/services/higgsfield.service';

/**
 * Non-blocking status check for a section's in-progress (or completed) Soul
 * Character training — pairs with the async createCharacter in
 * services/higgsfield.service.js. Safe to call repeatedly; does not retrain.
 */
export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { sectionId } = await params;
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) return NextResponse.json({ message: 'Section not found' }, { status: 404 });
    if (!section.videoCharacterId) {
      return NextResponse.json({ message: 'Section has no character training in progress' }, { status: 422 });
    }

    const status = await getCharacterStatus(section.videoCharacterId);
    return NextResponse.json({ data: status });
  } catch (e) {
    console.error('[GET /api/video/characters/[sectionId]/status]', e);
    return routeError(e, e?.message || 'Failed to check character status');
  }
}
