import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { requireRole } from '@/lib/require-role';
import { routeError } from '@/lib/route-error';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/scheduler/backfill-positions
 *
 * One-shot backfill: assigns sequential position values to all existing
 * ScheduledArticleSlot rows that still have the default position of 0.
 * Within each batch, slots are ordered by scheduledDate ASC then id ASC
 * (best approximation of intended order for legacy rows).
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    requireRole(session, 'superadmin', 'admin');

    const batches = await prisma.scheduleBatch.findMany({ select: { id: true } });

    let totalUpdated = 0;

    for (const batch of batches) {
      const slots = await prisma.scheduledArticleSlot.findMany({
        where: { batchId: batch.id },
        orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }],
        select: { id: true, position: true },
      });

      // Only update slots that haven't been assigned a real position yet
      // (all zeros means this batch predates the position column)
      const allZero = slots.every((s) => s.position === 0);
      if (!allZero) continue;

      await Promise.all(
        slots.map((slot, index) =>
          prisma.scheduledArticleSlot.update({
            where: { id: slot.id },
            data: { position: index },
          })
        )
      );

      totalUpdated += slots.length;
    }

    return NextResponse.json({ ok: true, totalUpdated, batchesProcessed: batches.length });
  } catch (err) {
    console.error('[backfill-positions]', err);
    return routeError(err, 'Backfill failed');
  }
}
