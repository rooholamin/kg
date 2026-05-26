import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : [],
  });
}

// Validate that the cached client has the new models; recreate if stale.
function getOrCreatePrisma() {
  if (globalForPrisma.prisma) {
    // If the client is missing a new model (e.g. after prisma generate), recreate it.
    if (typeof globalForPrisma.prisma.scheduledArticleSlot === 'undefined') {
      globalForPrisma.prisma = createPrismaClient();
    }
    return globalForPrisma.prisma;
  }
  return createPrismaClient();
}

export const prisma =
  process.env.NODE_ENV !== 'production'
    ? getOrCreatePrisma()
    : createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
