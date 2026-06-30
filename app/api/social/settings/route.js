import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const [settings, memory] = await Promise.all([
      prisma.socialSettings.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton' },
      }),
      prisma.socialAiMemory.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton' },
      }),
    ]);

    return NextResponse.json({ data: { settings, memory } });
  } catch (e) {
    return routeError('[GET /api/social/settings]', e);
  }
}

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const body = await req.json();

    const settingsAllowed = [
      'approvalAgentId',
      'approvalEnvironmentId',
      'contentAgentId',
      'contentEnvironmentId',
      'instagramCarouselProfileId',
      'instagramStoryProfileId',
      'linkedinProfileId',
      'twitterProfileId',
      'defaultMaxInstagramCarousel',
      'defaultMaxInstagramStory',
      'defaultMaxLinkedin',
      'defaultMaxTwitter',
      'instagramCarouselDays',
      'instagramCarouselWindowStart',
      'instagramCarouselWindowEnd',
      'instagramStoryDays',
      'instagramStoryWindowStart',
      'instagramStoryWindowEnd',
      'linkedinDays',
      'linkedinWindowStart',
      'linkedinWindowEnd',
      'twitterDays',
      'twitterWindowStart',
      'twitterWindowEnd',
      'lookbackDays',
      'timezoneOffset',
      'requireReview',
      'disabledTemplates',
    ];

    const memoryAllowed = ['sessionRotateAfter'];

    const settingsData = {};
    const memoryData = {};

    for (const key of settingsAllowed) {
      if (key in body) settingsData[key] = body[key];
    }
    for (const key of memoryAllowed) {
      if (key in body) memoryData[key] = body[key];
    }

    const [settings, memory] = await Promise.all([
      Object.keys(settingsData).length
        ? prisma.socialSettings.upsert({
            where: { id: 'singleton' },
            update: settingsData,
            create: { id: 'singleton', ...settingsData },
          })
        : prisma.socialSettings.upsert({
            where: { id: 'singleton' },
            update: {},
            create: { id: 'singleton' },
          }),
      Object.keys(memoryData).length
        ? prisma.socialAiMemory.upsert({
            where: { id: 'singleton' },
            update: memoryData,
            create: { id: 'singleton', ...memoryData },
          })
        : prisma.socialAiMemory.upsert({
            where: { id: 'singleton' },
            update: {},
            create: { id: 'singleton' },
          }),
    ]);

    return NextResponse.json({ data: { settings, memory } });
  } catch (e) {
    return routeError('[PATCH /api/social/settings]', e);
  }
}

// Reset AI session — clears activeSessionId so next campaign starts fresh
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    await prisma.socialAiMemory.upsert({
      where: { id: 'singleton' },
      update: {
        activeSessionId: null,
        sessionCampaignCount: 0,
        handoffSummary: null,
      },
      create: { id: 'singleton' },
    });

    return NextResponse.json({ message: 'AI session reset' });
  } catch (e) {
    return routeError('[DELETE /api/social/settings]', e);
  }
}
