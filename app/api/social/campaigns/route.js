import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { runFullPipeline } from '@/services/social-pipeline.service';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const campaigns = await prisma.socialCampaign.findMany({
      orderBy: { weekStart: 'desc' },
      include: {
        _count: { select: { posts: true } },
        posts: {
          select: { status: true, platform: true },
        },
      },
    });

    return NextResponse.json({ data: campaigns });
  } catch (e) {
    return routeError('[GET /api/social/campaigns]', e);
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const body = await req.json();
    const { weekStart, weekEnd, campaignBrief, editorsChoiceOnly, includeSections } = body;

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ message: 'weekStart and weekEnd are required' }, { status: 400 });
    }

    // Load defaults from SocialSettings
    const settings = await prisma.socialSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });

    const maxPostsPerPlatform = body.maxPostsPerPlatform || {
      instagram_carousel: settings.defaultMaxInstagramCarousel,
      instagram_story: settings.defaultMaxInstagramStory,
      linkedin: settings.defaultMaxLinkedin,
      twitter: settings.defaultMaxTwitter,
    };

    const campaign = await prisma.socialCampaign.create({
      data: {
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        status: 'pending',
        maxPostsPerPlatform,
        campaignBrief: campaignBrief || null,
        editorsChoiceOnly: editorsChoiceOnly || false,
        includeSections: includeSections || [],
      },
    });

    // Fire-and-forget: run the full pipeline in the background
    runFullPipeline(campaign.id).catch((err) =>
      console.error('[social-pipeline background]', err),
    );

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (e) {
    return routeError('[POST /api/social/campaigns]', e);
  }
}
