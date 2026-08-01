import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { runFullPipeline, createManualVideoPosts, runVideoPlanning } from '@/services/video-pipeline.service';

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
            scheduledAt: true,
            platforms: true,
            totalEstimatedCost: true,
            totalGenerationTimeMs: true,
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
      targetPlatform, videoStyle, targetShotCount, orientation,
      selectionMode, articleIds, maxPerDay,
    } = body;

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ message: 'weekStart and weekEnd are required' }, { status: 400 });
    }

    const isManual = selectionMode === 'manual';
    if (isManual && !articleIds?.length) {
      return NextResponse.json({ message: 'articleIds is required for manual selection' }, { status: 400 });
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
        selectionMode: isManual ? 'manual' : 'agent',
        // Article-date-range filtering no longer applies to video candidate
        // eligibility (see videoArticleEligibilityWhere) — always null now,
        // kept only for schema/back-compat with older campaigns.
        articleDateStart: isManual ? null : (articleDateStart ? new Date(articleDateStart) : null),
        articleDateEnd: isManual ? null : (articleDateEnd ? new Date(articleDateEnd) : null),
        status: 'pending',
        campaignBrief: isManual ? null : (campaignBrief || null),
        editorsChoiceOnly: editorsChoiceOnly || false,
        includeSections: includeSections || [],
        maxVideos: isManual ? articleIds.length : (maxVideos || settings.defaultMaxVideosPerCampaign),
        targetPlatform: targetPlatform || settings.defaultTargetPlatform,
        videoStyle: videoStyle || settings.defaultVideoStyle,
        targetShotCount: targetShotCount ?? settings.defaultTargetShotCount ?? null,
        orientation: orientation || settings.defaultOrientation,
      },
    });

    if (isManual) {
      try {
        await createManualVideoPosts(campaign.id, articleIds, maxPerDay);
      } catch (err) {
        await prisma.videoCampaign.update({ where: { id: campaign.id }, data: { status: 'failed' } });
        return routeError(err, 'Failed to create manually-selected video posts');
      }
      await prisma.videoCampaign.update({ where: { id: campaign.id }, data: { status: 'planning' } });
      // Fire-and-forget: draft plans for the manually-created posts (no
      // approval agent involved for manual campaigns)
      runVideoPlanning(campaign.id)
        .then(() => prisma.videoCampaign.update({ where: { id: campaign.id }, data: { status: 'reviewing' } }))
        .catch((err) => console.error('[video-pipeline background/manual]', err));
    } else {
      // Fire-and-forget: run the full pipeline (approval agent + planning) in the background
      runFullPipeline(campaign.id).catch((err) =>
        console.error('[video-pipeline background]', err),
      );
    }

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (e) {
    return routeError(e, 'Failed to create video campaign');
  }
}
