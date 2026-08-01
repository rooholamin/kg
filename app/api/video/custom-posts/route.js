import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { planStandaloneCustomPost } from '@/services/video-pipeline.service';

// Standalone custom videos — for individual, one-off use, no campaign or
// article at all. See app/(protected)/dashboard/video/custom/page.jsx.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const posts = await prisma.videoPost.findMany({
      where: { campaignId: null },
      include: { customCharacter: true, segments: { orderBy: { order: 'asc' } } },
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
    const { title, characterId, content } = body;
    if (!title || !characterId || !content) {
      return NextResponse.json({ message: 'title, characterId, and content are required' }, { status: 400 });
    }

    const character = await prisma.videoCharacter.findUnique({ where: { id: characterId } });
    if (!character) return NextResponse.json({ message: 'Character not found' }, { status: 404 });
    if (!character.videoCharacterId) {
      return NextResponse.json({ message: `"${character.name}" hasn't been trained yet — train it from Video → Characters first.` }, { status: 422 });
    }

    const post = await prisma.videoPost.create({
      data: {
        campaignId: null,
        customTitle: title,
        customContent: content,
        customCharacterId: characterId,
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
