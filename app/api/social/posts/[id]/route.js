import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json();

    const allowed = ['generatedText', 'hashtags', 'slideIds', 'scheduledAt'];
    const data = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    const post = await prisma.socialPost.update({ where: { id }, data });
    return NextResponse.json({ data: post });
  } catch (e) {
    return routeError('[PATCH /api/social/posts/[id]]', e);
  }
}
