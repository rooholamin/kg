import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { runFullPipeline } from '@/services/video-pipeline.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const campaigns = await prisma.videoCampaign.findMany({
      orderBy: { weekStart: 'desc' },
      include: {
        _count: { select: { posts: true } },
        posts: {
          select: {
            id: true,
            status: true,
            videoUrl: true,
            stillAssetUrl: true,
            scheduledAt: true,
            article: { select: { title: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: campaigns });
  } catch (e) {
    return routeError(e, 'Failed to load video campaigns');
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const body = await req.json();
    const {
      weekStart, weekEnd, articleDateStart, articleDateEnd,
      campaignBrief, editorsChoiceOnly, includeSections, maxVideos,
    } = body;

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ message: 'weekStart and weekEnd are required' }, { status: 400 });
    }

    const settings = await prisma.videoSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });

    const campaign = await prisma.videoCampaign.create({
      data: {
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        articleDateStart: articleDateStart ? new Date(articleDateStart) : null,
        articleDateEnd: articleDateEnd ? new Date(articleDateEnd) : null,
        status: 'pending',
        campaignBrief: campaignBrief || null,
        editorsChoiceOnly: editorsChoiceOnly || false,
        includeSections: includeSections || [],
        maxVideos: maxVideos || settings.defaultMaxVideosPerCampaign,
      },
    });

    // Fire-and-forget: run the full pipeline in the background
    runFullPipeline(campaign.id).catch((err) =>
      console.error('[video-pipeline background]', err),
    );

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (e) {
    return routeError(e, 'Failed to create video campaign');
  }
}
