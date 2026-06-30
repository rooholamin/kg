import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { deleteFromS3 } from '@/services/social-export.service';
import { logInfo } from '@/lib/social-logger';

export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    const campaign = await prisma.socialCampaign.findUnique({
      where: { id },
      include: {
        posts: {
          include: {
            article: {
              select: {
                id: true,
                title: true,
                featuredImage: true,
                category: {
                  select: {
                    name: true,
                    section: {
                      select: { name: true, slug: true, colorAccent: true },
                    },
                  },
                },
              },
            },
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
    return routeError('[GET /api/social/campaigns/[id]]', e);
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
      // Mark remaining pending/queued posts as cancelled so the pipeline skips them
      await prisma.socialPost.updateMany({
        where: { campaignId: id, status: { in: ['pending', 'content_generating'] } },
        data: { status: 'failed', errorMessage: 'Pipeline stopped by user' },
      });

      await prisma.socialCampaign.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      await logInfo(id, 'pipeline_stopped', 'Pipeline stopped by user');

      return NextResponse.json({ message: 'Pipeline stopped' });
    }

    return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return routeError('[PATCH /api/social/campaigns/[id]]', e);
  }
}

export async function DELETE(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const { id } = await params;

    const campaign = await prisma.socialCampaign.findUnique({
      where: { id },
      include: { posts: { select: { imageUrls: true } } },
    });
    if (!campaign) {
      return NextResponse.json({ message: 'Campaign not found' }, { status: 404 });
    }

    // Delete exported images from Spaces first
    const allUrls = campaign.posts.flatMap((p) => p.imageUrls ?? []);
    await Promise.all(allUrls.map((url) => deleteFromS3(url)));

    // Delete DB records (cascade handles posts + logs, but be explicit)
    await prisma.socialCampaignLog.deleteMany({ where: { campaignId: id } });
    await prisma.socialPost.deleteMany({ where: { campaignId: id } });
    await prisma.socialCampaign.delete({ where: { id } });

    return NextResponse.json({ message: 'Campaign deleted' });
  } catch (e) {
    return routeError('[DELETE /api/social/campaigns/[id]]', e);
  }
}
