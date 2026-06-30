import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { generatePostContent } from '@/services/social-ai.service';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const toneSeed = body.toneSeed || null;

    const post = await prisma.socialPost.findUnique({
      where: { id },
      include: {
        article: {
          include: { category: { include: { section: true } } },
        },
      },
    });
    if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 });

    const section = post.article.category?.section;
    if (!section) return NextResponse.json({ message: 'Article has no section' }, { status: 400 });

    await prisma.socialPost.update({
      where: { id },
      data: { status: 'content_generating', errorMessage: null },
    });

    const content = await generatePostContent({
      article: post.article,
      section,
      platform: post.platform,
      toneSeed,
    });

    const updated = await prisma.socialPost.update({
      where: { id },
      data: {
        status: 'content_ready',
        slideIds: content.slideIds || [],
        generatedText: content.text || '',
        hashtags: content.hashtags || [],
        placeholders: content.placeholders || {},
        exportTotal: (content.slideIds || []).length,
        exportProgress: 0,
        imageUrls: [],
      },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    return routeError('[POST /api/social/posts/[id]/regenerate]', e);
  }
}
