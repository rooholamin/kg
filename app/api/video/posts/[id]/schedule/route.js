import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { schedulePost } from '@/services/video-pipeline.service';

export async function POST(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;

    const post = await prisma.videoPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    }
    if (post.status !== 'uploaded' && post.status !== 'failed') {
      return NextResponse.json(
        { message: `Post must be in "uploaded" or "failed" status to schedule (current: ${post.status})` },
        { status: 422 },
      );
    }

    const bufferPostIds = await schedulePost(id);
    return NextResponse.json({ bufferPostIds });
  } catch (e) {
    return routeError(e, 'Failed to schedule video');
  }
}
