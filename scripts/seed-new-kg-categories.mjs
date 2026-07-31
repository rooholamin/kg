/**
 * One-off script to upsert a specific set of new Category/Topic records
 * (added to prisma/data/kg-sections-content.js) into a target database,
 * without touching users, roles, sections, or any other seed data.
 *
 * Scoped to category ids 30000000-0000-4000-8000-000000000071..105 and
 * topic ids 40000000-0000-4000-8000-000000000701..001050 (the DIY/maintenance
 * categories imported from kg_living.csv, kg_build.csv, kg_design.csv,
 * kg_eco.csv on 2026-07-31).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/seed-new-kg-categories.mjs
 */
import { PrismaClient } from '@prisma/client';
import { categories, topics } from '../prisma/data/kg-sections-content.js';

const prisma = new PrismaClient();

const NEW_CATEGORY_IDS = new Set(
  categories
    .map((c) => c.id)
    .filter((id) => {
      if (!id.startsWith('30000000-0000-4000-8000-')) return false;
      const n = parseInt(id.slice(id.lastIndexOf('-') + 1), 10);
      return n >= 71 && n <= 105;
    }),
);

const newCategories = categories.filter((c) => NEW_CATEGORY_IDS.has(c.id));
const newTopics = topics.filter((t) => NEW_CATEGORY_IDS.has(t.categoryId));

async function main() {
  console.log(`About to upsert ${newCategories.length} categories and ${newTopics.length} topics.`);

  await prisma.$transaction(
    async (tx) => {
      for (const c of newCategories) {
        await tx.category.upsert({
          where: { id: c.id },
          update: { name: c.name, status: c.status, sectionId: c.sectionId },
          create: { id: c.id, name: c.name, status: c.status, sectionId: c.sectionId },
        });
      }
      console.log(`Upserted ${newCategories.length} categories.`);

      for (const t of newTopics) {
        await tx.topic.upsert({
          where: { id: t.id },
          update: { name: t.name, status: t.status, categoryId: t.categoryId },
          create: { id: t.id, name: t.name, status: t.status, categoryId: t.categoryId },
        });
      }
      console.log(`Upserted ${newTopics.length} topics.`);
    },
    { timeout: 120000, maxWait: 120000 },
  );

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
