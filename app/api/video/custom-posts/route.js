import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { planStandaloneCustomPost } from '@/services/video-pipeline.service';
import { resolveCustomVideoCharacter, customEnvironmentFields } from '@/lib/video-custom-post';

// Standalone custom videos — for individual, one-off use, no campaign or
// article at all. See app/(protected)/dashboard/video/custom/page.jsx.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const posts = await prisma.videoPost.findMany({
      where: { campaignId: null },
      include: { customCharacter: true, customSection: true, segments: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: posts });
  } catch (e) {
    return routeError(e, 'Failed to load custom videos');
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const body = await req.json();
    const { title, characterId, sectionId, content, environmentName, environmentDescription } = body;
    if (!title || !content || (!characterId && !sectionId)) {
      return NextResponse.json({ message: 'title, content, and one of characterId or sectionId are required' }, { status: 400 });
    }

    const resolved = await resolveCustomVideoCharacter({ characterId, sectionId });
    if (resolved.error) return NextResponse.json({ message: resolved.error }, { status: resolved.status });

    const post = await prisma.videoPost.create({
      data: {
        campaignId: null,
        customTitle: title,
        customContent: content,
        ...resolved.data,
        ...customEnvironmentFields({ environmentName, environmentDescription }),
        status: 'pending',
      },
    });

    // Fire-and-forget: draft a plan for this one campaign-less post.
    planStandaloneCustomPost(post.id).catch((err) => console.error('[video-pipeline background/standalone]', err));

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (e) {
    return routeError(e, 'Failed to create custom video');
  }
}
