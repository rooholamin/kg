import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

// Lightweight polling endpoint for the post detail page's progress indicator
// (Re-assemble / Regenerate music) — returns the most recent pipeline log
// rows for this post so the UI can show whichever step is currently
// "running" (stitching, generating music, mixing, captions, uploading...).
export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const logs = await prisma.videoCampaignLog.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ data: logs });
  } catch (e) {
    return routeError(e, 'Failed to load post logs');
  }
}
