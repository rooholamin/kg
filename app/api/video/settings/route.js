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
      prisma.videoSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } }),
      prisma.videoAiMemory.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } }),
    ]);

    return NextResponse.json({ data: { settings, memory } });
  } catch (e) {
    return routeError(e, 'Failed to load video settings');
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
      'directorAgentId',
      'directorEnvironmentId',
      'defaultMaxVideosPerCampaign',
      'defaultDuration',
      'defaultAspectRatio',
      'defaultGenre',
      'defaultPlatforms',
      'maxGenerationsPerPost',
      'requireReview',
    ];
    const memoryAllowed = ['sessionRotateAfter'];

    const settingsData = {};
    const memoryData = {};
    for (const key of settingsAllowed) if (key in body) settingsData[key] = body[key];
    for (const key of memoryAllowed) if (key in body) memoryData[key] = body[key];

    const [settings, memory] = await Promise.all([
      prisma.videoSettings.upsert({
        where: { id: 'singleton' },
        update: settingsData,
        create: { id: 'singleton', ...settingsData },
      }),
      prisma.videoAiMemory.upsert({
        where: { id: 'singleton' },
        update: memoryData,
        create: { id: 'singleton', ...memoryData },
      }),
    ]);

    return NextResponse.json({ data: { settings, memory } });
  } catch (e) {
    return routeError(e, 'Failed to update video settings');
  }
}

// Reset AI session — clears activeSessionId so next campaign starts fresh
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    await prisma.videoAiMemory.upsert({
      where: { id: 'singleton' },
      update: { activeSessionId: null, sessionCampaignCount: 0, handoffSummary: null },
      create: { id: 'singleton' },
    });

    return NextResponse.json({ message: 'AI session reset' });
  } catch (e) {
    return routeError(e, 'Failed to reset AI session');
  }
}
