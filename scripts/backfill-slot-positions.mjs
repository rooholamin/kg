import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const batches = await prisma.scheduleBatch.findMany({ select: { id: true, name: true } });
  console.log(`Found ${batches.length} batch(es) to process.`);

  let totalUpdated = 0;

  for (const batch of batches) {
    const slots = await prisma.scheduledArticleSlot.findMany({
      where: { batchId: batch.id },
      orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }],
      select: { id: true, position: true, scheduledDate: true },
    });

    if (slots.length === 0) continue;

    const allZero = slots.every((s) => s.position === 0);
    if (!allZero) {
      console.log(`  Batch "${batch.name}" — already has positions, skipping.`);
      continue;
    }

    await Promise.all(
      slots.map((slot, index) =>
        prisma.scheduledArticleSlot.update({
          where: { id: slot.id },
          data: { position: index },
        })
      )
    );

    console.log(`  Batch "${batch.name}" — assigned positions to ${slots.length} slots.`);
    totalUpdated += slots.length;
  }

  console.log(`\nDone. Updated ${totalUpdated} slot(s) total.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
