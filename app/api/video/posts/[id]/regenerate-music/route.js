import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { regenerateMusic } from '@/services/video-pipeline.service';

// Swaps in a fresh background music track without re-touching Higgsfield or
// re-processing segments — reuses the base render from the last Re-assemble.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const note = body.note || null;

    const result = await regenerateMusic(id, note);

    const updated = await prisma.videoPost.findUnique({
      where: { id },
      include: { segments: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json({ data: updated, result });
  } catch (e) {
    return routeError(e, 'Failed to regenerate music');
  }
}
