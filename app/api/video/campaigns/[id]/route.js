import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { deleteFromS3 } from '@/services/social-export.service';
import { logInfo } from '@/lib/video-logger';
import { resumePipeline } from '@/services/video-pipeline.service';

export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    const campaign = await prisma.videoCampaign.findUnique({
      where: { id },
      include: {
        posts: {
          include: {
            article: {
              select: {
                id: true,
                title: true,
                featuredImage: true,
                publishDate: true,
                category: {
                  select: {
                    name: true,
                    section: { select: { name: true, slug: true, colorAccent: true } },
                  },
                },
              },
            },
            segments: { orderBy: { order: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ data: campaign });
  } catch (e) {
    return routeError(e, 'Failed to load video campaign');
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;
    const { action } = await req.json();

    if (action === 'stop') {
      await prisma.videoPost.updateMany({
        where: { campaignId: id, status: { in: ['pending', 'planning', 'plan_ready', 'approved', 'directing'] } },
        data: { status: 'failed', errorMessage: 'Pipeline stopped by user' },
      });
      await prisma.videoCampaign.update({ where: { id }, data: { status: 'cancelled' } });
      await logInfo(id, 'pipeline_stopped', 'Pipeline stopped by user');
      return NextResponse.json({ message: 'Pipeline stopped' });
    }

    if (action === 'pause') {
      await prisma.videoCampaign.update({ where: { id }, data: { status: 'paused' } });
      await logInfo(id, 'pipeline_paused', 'Pipeline paused by user');
      return NextResponse.json({ message: 'Pipeline paused' });
    }

    if (action === 'resume') {
      resumePipeline(id).catch((err) => console.error('[video-pipeline resume]', err));
      return NextResponse.json({ message: 'Pipeline resuming' });
    }

    return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return routeError(e, 'Failed to update video campaign');
  }
}

export async function DELETE(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;

    const campaign = await prisma.videoCampaign.findUnique({
      where: { id },
      include: { posts: { select: { videoUrl: true, musicUrl: true, segments: { select: { videoUrl: true } } } } },
    });
    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 });
    }

    const allUrls = campaign.posts.flatMap((p) => [
      p.videoUrl,
      p.musicUrl,
      ...p.segments.map((s) => s.videoUrl),
    ]).filter(Boolean);
    await Promise.all(allUrls.map((url) => deleteFromS3(url)));

    await prisma.videoCampaignLog.deleteMany({ where: { campaignId: id } });
    await prisma.videoPost.deleteMany({ where: { campaignId: id } });
    await prisma.videoCampaign.delete({ where: { id } });

    return NextResponse.json({ message: 'Campaign deleted' });
  } catch (e) {
    return routeError(e, 'Failed to delete video campaign');
  }
}
