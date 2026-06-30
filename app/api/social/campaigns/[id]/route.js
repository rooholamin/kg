import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

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
