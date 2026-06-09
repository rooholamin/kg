import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';
import { syncCategoryToWordPress } from '@/services/wordpress.service';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }
    requireRole(session, 'superadmin', 'admin');

    // Find all active categories that haven't been synced yet
    const unsynced = await prisma.category.findMany({
      where: { wpCategoryId: null, status: 'active' },
      include: { section: true },
      orderBy: { name: 'asc' },
    });

    const results = { synced: 0, skipped: 0, errors: [] };

    for (const category of unsynced) {
      if (!category.section?.wpSiteUrl || !category.section?.wpUsername || !category.section?.wpAppPassword) {
        results.skipped++;
        continue;
      }

      try {
        await syncCategoryToWordPress(category.id, session.user?.id ?? null);
        results.synced++;
      } catch (err) {
        results.errors.push({ id: category.id, name: category.name, error: err.message });
      }
    }

    return NextResponse.json({ ok: true, data: results });
  } catch (e) {
    console.error('[api/categories/wordpress/sync-all]', e);
    return NextResponse.json({ message: 'Failed to sync categories' }, { status: 500 });
  }
}
