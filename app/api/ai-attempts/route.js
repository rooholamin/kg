import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { createAttempt, getAttempts } from '@/services/ai-attempt.service';
import { z } from 'zod';

const CreateAttemptSchema = z.object({
  articleId: z.string().uuid().optional().nullable(),
  prompt: z.string().min(1),
  result: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(['success', 'failed']).optional(),
});

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const articleId = searchParams.get('articleId');
    const rows = await getAttempts(articleId || undefined);

    const data = rows.map((a) => ({
      id: a.id,
      articleId: a.articleId,
      prompt: a.prompt,
      result: a.result,
      model: a.model,
      status: a.status,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    console.error('[api/ai-attempts GET]', e);
    return NextResponse.json(
      { message: 'Failed to load attempts' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = CreateAttemptSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return NextResponse.json(
        { message: first?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const row = await createAttempt(parsed.data);
    return NextResponse.json({
      data: {
        id: row.id,
        articleId: row.articleId,
        prompt: row.prompt,
        result: row.result,
        model: row.model,
        status: row.status,
        createdAt: row.createdAt,
      },
    });
  } catch (e) {
    console.error('[api/ai-attempts POST]', e);
    return NextResponse.json(
      { message: 'Failed to save attempt' },
      { status: 500 },
    );
  }
}
