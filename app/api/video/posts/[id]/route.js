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
    const post = await prisma.videoPost.findUnique({
      where: { id },
      include: {
        article: { select: { id: true, title: true, publishDate: true } },
        segments: { orderBy: { order: 'asc' } },
      },
    });
    if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 });

    return NextResponse.json({ data: post });
  } catch (e) {
    return routeError(e, 'Failed to load video post');
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json();

    const allowed = [
      'generatedText', 'hashtags', 'scheduledAt', 'directorNote', 'platforms',
      'plan', 'musicVolume', 'captionsEnabled',
      'targetPlatform', 'videoStyle', 'targetShotCount', 'orientation',
    ];
    const data = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    const post = await prisma.videoPost.update({ where: { id }, data });
    return NextResponse.json({ data: post });
  } catch (e) {
    return routeError(e, 'Failed to update video post');
  }
}
