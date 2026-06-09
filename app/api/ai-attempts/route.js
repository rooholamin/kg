import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { createAttempt, getAttempts } from '@/services/ai-attempt.service';
import { z } from 'zod';

const CreateAttemptSchema = z.object({
  type: z.enum(['planning', 'research', 'writing', 'image_generation']),
  articleId: z.string().uuid().optional().nullable(),
  slotId: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
  result: z.string().optional().nullable(),
  model: z.string().min(1),
  status: z.enum(['success', 'failed']).optional(),
  isRedo: z.boolean().optional(),
  triggeredBy: z.string().optional().nullable(),
});

function serialize(a) {
  return {
    id: a.id,
    type: a.type,
    articleId: a.articleId,
    slotId: a.slotId,
    prompt: a.prompt,
    result: a.result,
    model: a.model,
    status: a.status,
    isRedo: a.isRedo,
    triggeredBy: a.triggeredBy,
    createdAt: a.createdAt,
  };
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    const { searchParams } = new URL(req.url);
    const articleId = searchParams.get('articleId') || undefined;
    const slotId = searchParams.get('slotId') || undefined;
    const type = searchParams.get('type') || undefined;

    const rows = await getAttempts({ articleId, slotId, type });
    return NextResponse.json({ data: rows.map(serialize) });
  } catch (e) {
    console.error('[api/ai-attempts GET]', e);
    return NextResponse.json({ message: 'Failed to load attempts' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

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
    return NextResponse.json({ data: serialize(row) });
  } catch (e) {
    console.error('[api/ai-attempts POST]', e);
    return NextResponse.json({ message: 'Failed to save attempt' }, { status: 500 });
  }
}
