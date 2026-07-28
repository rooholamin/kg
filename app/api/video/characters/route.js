import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin', 'editor');

    const sections = await prisma.section.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        characterName: true,
        characterImage: true,
        videoCharacterId: true,
        videoRefImageUrls: true,
        videoOutfitDescription: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: sections });
  } catch (e) {
    return routeError(e, 'Failed to load section video characters');
  }
}
