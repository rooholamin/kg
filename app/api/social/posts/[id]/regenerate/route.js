import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { regeneratePostContent } from '@/services/social-pipeline.service';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    // instruction: optional natural-language change request, e.g. "make it more concise"
    const instruction = body.instruction || body.toneSeed || null;

    await prisma.socialPost.update({
      where: { id },
      data: { status: 'content_generating', errorMessage: null, exportProgress: 0, imageUrls: [] },
    });

    // Continues the existing content session so the agent has memory of what it generated
    const result = await regeneratePostContent(id, instruction);

    const updated = await prisma.socialPost.findUnique({ where: { id } });
    return NextResponse.json({ data: updated, result });
  } catch (e) {
    return routeError('[POST /api/social/posts/[id]/regenerate]', e);
  }
}
