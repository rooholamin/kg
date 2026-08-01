import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

// Standalone character roster, additive to Section.videoCharacterId — used
// by custom videos that aren't derived from an article/section at all.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const characters = await prisma.videoCharacter.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ data: characters });
  } catch (e) {
    return routeError(e, 'Failed to load character roster');
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const body = await req.json();
    const { name, persona, tone } = body;
    if (!name) return NextResponse.json({ message: 'name is required' }, { status: 400 });

    const character = await prisma.videoCharacter.create({
      data: { name, persona: persona || null, tone: tone || null },
    });
    return NextResponse.json({ data: character }, { status: 201 });
  } catch (e) {
    return routeError(e, 'Failed to create character');
  }
}
