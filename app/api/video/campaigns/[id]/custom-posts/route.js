import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { runVideoPlanning } from '@/services/video-pipeline.service';

// Creates a custom video (content provided directly, no article) attached to
// an existing campaign — works alongside agent- or manually-selected posts
// in the same campaign.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id: campaignId } = await params;
    const campaign = await prisma.videoCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return NextResponse.json({ message: 'Campaign not found' }, { status: 404 });

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
        campaignId,
        customTitle: title,
        customContent: content,
        customCharacterId: characterId,
        status: 'pending',
      },
    });

    // Fire-and-forget: draft a plan for just this post (runVideoPlanning
    // already scopes to status "pending", so it won't touch other posts).
    runVideoPlanning(campaignId).catch((err) => console.error('[video-pipeline background/custom]', err));

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (e) {
    return routeError(e, 'Failed to create custom video');
  }
}
