import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

/**
 * Reference Element creation (see [sectionId]/train/route.js) is
 * synchronous — media_import_url + show_reference_elements both resolve
 * inline within that same request, so there is no separate async job to
 * poll here. This route just reflects whatever the train call already
 * confirmed: if Section.videoCharacterId is set, the element exists.
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
      return NextResponse.json({ message: 'Section has no video character yet' }, { status: 422 });
    }

    return NextResponse.json({ data: { id: section.videoCharacterId, status: 'completed' } });
  } catch (e) {
    console.error('[GET /api/video/characters/[sectionId]/status]', e);
    return routeError(e, e?.message || 'Failed to check character status');
  }
}
