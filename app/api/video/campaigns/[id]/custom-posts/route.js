import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { runVideoPlanning } from '@/services/video-pipeline.service';
import { resolveCustomVideoCharacter, customEnvironmentFields } from '@/lib/video-custom-post';

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
    const { title, characterId, sectionId, content, environmentName, environmentDescription } = body;
    if (!title || !content || (!characterId && !sectionId)) {
      return NextResponse.json({ message: 'title, content, and one of characterId or sectionId are required' }, { status: 400 });
    }

    const resolved = await resolveCustomVideoCharacter({ characterId, sectionId });
    if (resolved.error) return NextResponse.json({ message: resolved.error }, { status: resolved.status });

    const post = await prisma.videoPost.create({
      data: {
        campaignId,
        customTitle: title,
        customContent: content,
        ...resolved.data,
        ...customEnvironmentFields({ environmentName, environmentDescription }),
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
