import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';
import { syncTopicToWordPress } from '@/services/wordpress.service';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    // Find all active topics that haven't been synced yet
    const unsynced = await prisma.topic.findMany({
      where: { wpCategoryId: null, status: 'active' },
      include: { category: { include: { section: true } } },
      orderBy: { name: 'asc' },
    });

    const results = { synced: 0, skipped: 0, errors: [] };

    for (const topic of unsynced) {
      const section = topic.category?.section;
      if (!section?.wpSiteUrl || !section?.wpUsername || !section?.wpAppPassword) {
        results.skipped++;
        continue;
      }

      if (!topic.category?.wpCategoryId) {
        results.skipped++;
        results.errors.push({
          id: topic.id,
          name: topic.name,
          error: `Parent category "${topic.category?.name}" not synced yet — sync categories first`,
        });
        continue;
      }

      try {
        await syncTopicToWordPress(topic.id, session.user?.id ?? null);
        results.synced++;
      } catch (err) {
        results.errors.push({ id: topic.id, name: topic.name, error: err.message });
      }
    }

    return NextResponse.json({ ok: true, data: results });
  } catch (e) {
    console.error('[api/topics/wordpress/sync-all]', e);
    return NextResponse.json({ message: 'Failed to sync topics' }, { status: 500 });
  }
}
