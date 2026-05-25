import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getArticleById, getArticleVersions } from '@/services/article.service';

export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const article = await getArticleById(id);
    if (!article) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const rows = await getArticleVersions(id);
    const data = rows.map((v) => ({
      id: v.id,
      articleId: v.articleId,
      title: v.title,
      summary: v.summary,
      content: v.content,
      versionLabel: v.versionLabel,
      createdBy: v.createdBy,
      createdAt: v.createdAt,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/articles/:id/versions]', e);
    return NextResponse.json(
      { message: 'Failed to load versions' },
      { status: 500 },
    );
  }
}
