import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { triggerResearch } from '@/services/article-automation.service';
import { prisma } from '@/lib/prisma';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    let angle;
    try {
      const body = await req.json();
      angle = body?.angle ?? undefined;
    } catch { /* empty body is fine */ }

    const result = await triggerResearch(id, session.user?.id ?? null, { angle });

    if (!result.ok) {
      // Return the n8n error detail to the client so it can be displayed
      return NextResponse.json(
        { ok: false, message: result.error ?? 'Research workflow failed' },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    console.error('[api/articles/:id/automation/research POST]', e);
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ message: e.message }, { status: 404 });
    }
    return NextResponse.json({ message: e?.message ?? 'Failed to trigger research workflow' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const allowed = ['summary', 'keyFacts', 'sources', 'searchQueries', 'notes'];
    const data = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k)),
    );

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'No valid fields provided' }, { status: 400 });
    }

    const research = await prisma.articleResearch.upsert({
      where: { articleId: id },
      create: { articleId: id, ...data },
      update: { ...data, updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, data: research });
  } catch (e) {
    console.error('[api/articles/:id/automation/research PATCH]', e);
    return NextResponse.json({ message: 'Failed to save research edits' }, { status: 500 });
  }
}
