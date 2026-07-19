import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { exportAllContent } from '@/services/social-pipeline.service';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const platform = body.platform || null;

    const count = await prisma.socialPost.count({
      where: { campaignId: id, status: 'content_ready', ...(platform ? { platform } : {}) },
    });

    // Run in background — exports are throttled by runExport's own
    // MAX_CONCURRENT_EXPORTS queue and can take a while for many posts;
    // client polls for status instead of waiting on this request.
    exportAllContent(id, platform).catch((err) => console.error('[export-all background]', err));

    return NextResponse.json({ message: 'Export started', count });
  } catch (e) {
    return routeError('[POST /api/social/campaigns/[id]/export-all]', e);
  }
}
