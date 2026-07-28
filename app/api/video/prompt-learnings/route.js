import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

// DB-backed equivalent of seedance-failures.md — the last ~10 rows are
// injected into every Video Director Agent session (see
// video-pipeline.service.js's getRecentPromptLearnings), so this compounds
// over time without needing to re-upload the director agent's Skill.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const learnings = await prisma.videoPromptLearning.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ data: learnings });
  } catch (e) {
    return routeError(e, 'Failed to load prompt learnings');
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const body = await req.json();
    const { triggerPhrase, failureType, safeRewrite, notes } = body;

    if (!triggerPhrase || !failureType) {
      return NextResponse.json({ message: 'triggerPhrase and failureType are required' }, { status: 400 });
    }

    const learning = await prisma.videoPromptLearning.create({
      data: { triggerPhrase, failureType, safeRewrite: safeRewrite || null, notes: notes || null },
    });

    return NextResponse.json({ data: learning }, { status: 201 });
  } catch (e) {
    return routeError(e, 'Failed to save prompt learning');
  }
}
