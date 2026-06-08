import { prisma } from '@/lib/prisma';
import { triggerResearch, triggerWriting, triggerAssets } from '@/services/article-automation.service';
import { contentLog } from '@/services/content-log.service';

// ---------------------------------------------------------------------------
// Engine configuration
// ---------------------------------------------------------------------------

export const ENGINE_IDS = ['research', 'writing', 'images'];

const ENGINE_CONFIGS = {
  research: {
    label: 'Research Engine',
    queueStatuses: ['planning', 'research'], // 'research' = stalled mid-research
    step: 'research',
  },
  writing: {
    label: 'Writing Engine',
    queueStatuses: ['writing'],
    step: 'writing',
  },
  images: {
    label: 'Image Engine',
    queueStatuses: ['assets'],
    step: 'assets',
  },
};

const STALL_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const EMPTY_QUEUE_POLL_MS = 60 * 1000;     // re-check every 60s when queue is empty

/**
 * Per-engine in-memory skip sets. Articles that fail during this server
 * session are excluded from the queue so a stuck article can't loop forever.
 * Cleared on startEngine() so retries happen after every fresh start.
 */
const skippedArticleIds = {
  research: new Set(),
  writing: new Set(),
  images: new Set(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertValidEngine(engineId) {
  if (!ENGINE_CONFIGS[engineId]) {
    throw new Error(`Unknown engine: ${engineId}`);
  }
}

/** Upsert a single engine row and return it. */
async function ensureEngine(engineId) {
  return prisma.pipelineEngine.upsert({
    where: { id: engineId },
    create: { id: engineId },
    update: {},
  });
}

/** Compute staleness and ms until next eligible run for an engine row. */
function enrichEngine(engine) {
  const isStalled =
    engine.status === 'running' &&
    Date.now() - new Date(engine.updatedAt).getTime() > STALL_THRESHOLD_MS;

  // Waiting = running but not currently processing anything (polling for new articles)
  const isWaiting = engine.status === 'running' && !engine.currentArticleId;

  let nextRunMs = null;
  if (engine.status === 'running' && engine.delayMinutes > 0 && engine.lastJobCompletedAt) {
    const delayMs = engine.delayMinutes * 60 * 1000;
    const elapsed = Date.now() - new Date(engine.lastJobCompletedAt).getTime();
    nextRunMs = Math.max(0, delayMs - elapsed);
  }

  return { ...engine, isStalled, isWaiting, nextRunMs };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the status of all 3 engines plus the combined queue.
 */
export async function getEngineStatus() {
  const ALL_QUEUE_STATUSES = ['planning', 'research', 'writing', 'assets'];

  const [engineRows, stageCounts, queue, pendingImages, recentHistory] = await Promise.all([
    prisma.pipelineEngine.findMany({ where: { id: { in: ENGINE_IDS } } }),

    prisma.article.groupBy({
      by: ['status'],
      where: { status: { in: ALL_QUEUE_STATUSES } },
      _count: { id: true },
    }),

    prisma.article.findMany({
      where: { status: { in: ALL_QUEUE_STATUSES } },
      orderBy: [{ readinessDeadline: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        readinessDeadline: true,
        publishDate: true,
        category: { select: { name: true } },
      },
    }),

    prisma.articleAssetRequest.count({
      where: { status: { in: ['pending', 'failed'] } },
    }),

    prisma.pipelineEngineLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: { article: { select: { title: true, category: { select: { name: true } } } } },
    }),
  ]);

  // Build engines map, fetching current article for each running engine
  const engineMap = {};
  await Promise.all(
    ENGINE_IDS.map(async (id) => {
      const row = engineRows.find((e) => e.id === id) ?? { id, status: 'idle', totalProcessed: 0, totalFailed: 0, delayMinutes: 0, lastJobCompletedAt: null, currentArticleId: null, currentStep: null, pauseReason: null, updatedAt: new Date() };
      const enriched = enrichEngine(row);
      const currentArticle = row.currentArticleId
        ? await prisma.article.findUnique({
            where: { id: row.currentArticleId },
            select: { id: true, title: true, status: true, category: { select: { name: true } } },
          })
        : null;
      engineMap[id] = { ...enriched, currentArticle };
    }),
  );

  const byStage = Object.fromEntries(
    stageCounts.map((r) => [r.status, r._count.id]),
  );
  const queueCount = stageCounts.reduce((sum, r) => sum + r._count.id, 0);

  const skippedCounts = Object.fromEntries(
    ENGINE_IDS.map((id) => [id, skippedArticleIds[id].size]),
  );

  return {
    engines: engineMap,
    queueCount,
    byStage,
    pendingImages,
    queue,
    recentHistory,
    skippedCounts,
  };
}

/**
 * Reset stale automation state left behind by a crashed session.
 */
async function cleanupStaleState() {
  const [resetAssets, failedRuns] = await Promise.all([
    prisma.articleAssetRequest.updateMany({
      where: { status: 'generating' },
      data: { status: 'pending' },
    }),
    prisma.articleAutomationRun.updateMany({
      where: { status: 'running' },
      data: {
        status: 'failed',
        errorMessage: 'Interrupted — server restarted or engine was stopped',
        updatedAt: new Date(),
      },
    }),
  ]);

  if (resetAssets.count > 0 || failedRuns.count > 0) {
    console.log(
      `[pipeline-engine] Stale cleanup: ${resetAssets.count} asset(s) unblocked, ${failedRuns.count} run(s) cleared`,
    );
    await contentLog({
      type: 'system',
      action: 'automation',
      message: `Engine startup cleanup: ${resetAssets.count} stuck asset(s) unblocked, ${failedRuns.count} zombie run(s) cleared`,
    });
  }

  return { resetAssets: resetAssets.count, failedRuns: failedRuns.count };
}

/**
 * Start (or restart if stalled) a specific engine.
 */
export async function startEngine(engineId, userId) {
  assertValidEngine(engineId);

  const current = await ensureEngine(engineId);
  const isStalled =
    current.status === 'running' &&
    Date.now() - new Date(current.updatedAt).getTime() > STALL_THRESHOLD_MS;

  if (current.status === 'running' && !isStalled) {
    console.log(`[pipeline-engine/${engineId}] Already running — ignoring start`);
    return getEngineStatus();
  }

  if (isStalled) {
    console.log(`[pipeline-engine/${engineId}] Stalled engine detected — restarting`);
  }

  skippedArticleIds[engineId].clear();

  // Only cleanup on first engine start (avoid redundant cleanup on each of 3 starts)
  const anyOtherRunning = (
    await prisma.pipelineEngine.count({
      where: { id: { not: engineId }, status: 'running' },
    })
  ) > 0;
  if (!anyOtherRunning) {
    await cleanupStaleState();
  }

  await prisma.pipelineEngine.upsert({
    where: { id: engineId },
    create: { id: engineId, status: 'running' },
    update: { status: 'running', pauseReason: null, currentArticleId: null, currentStep: null },
  });

  await contentLog({
    type: 'system',
    action: 'automation',
    message: `${ENGINE_CONFIGS[engineId].label} started`,
    createdBy: userId ?? null,
  });

  processNext(engineId, userId).catch((err) =>
    console.error(`[pipeline-engine/${engineId}] processNext error:`, err),
  );

  return getEngineStatus();
}

/**
 * Pause a specific engine. Stops after the current article's step finishes.
 */
export async function pauseEngine(engineId, userId, reason = 'manual') {
  assertValidEngine(engineId);

  await prisma.pipelineEngine.upsert({
    where: { id: engineId },
    create: { id: engineId, status: 'paused', pauseReason: reason },
    update: { status: 'paused', pauseReason: reason },
  });

  await contentLog({
    type: 'system',
    action: 'automation',
    message: `${ENGINE_CONFIGS[engineId].label} paused${reason !== 'manual' ? ` — ${reason}` : ''}`,
    createdBy: userId ?? null,
  });

  return getEngineStatus();
}

/**
 * Update per-engine settings (delayMinutes).
 */
export async function updateEngineSettings(engineId, { delayMinutes }) {
  assertValidEngine(engineId);

  if (typeof delayMinutes !== 'number' || delayMinutes < 0 || delayMinutes > 1440) {
    throw new Error('delayMinutes must be a number between 0 and 1440');
  }

  await prisma.pipelineEngine.upsert({
    where: { id: engineId },
    create: { id: engineId, delayMinutes },
    update: { delayMinutes },
  });

  return getEngineStatus();
}

// ---------------------------------------------------------------------------
// Core processing loop
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget: find the next article for this engine, run its step,
 * then schedule itself again (respecting delayMinutes rate limit).
 */
export async function processNext(engineId, userId) {
  const engine = await prisma.pipelineEngine.findUnique({ where: { id: engineId } });
  if (!engine || engine.status !== 'running') return;

  // Concurrency guard: if currentArticleId is set, another processNext chain is
  // actively mid-step for this engine. Bail to avoid double-processing.
  // (startEngine clears currentArticleId before firing, so this only blocks
  //  genuine concurrent calls, not stale values from a previous session.)
  if (engine.currentArticleId) {
    console.log(`[pipeline-engine/${engineId}] Article ${engine.currentArticleId} already in progress — exiting duplicate chain`);
    return;
  }

  const config = ENGINE_CONFIGS[engineId];
  const skipList = [...skippedArticleIds[engineId]];

  const article = await prisma.article.findFirst({
    where: {
      status: { in: config.queueStatuses },
      ...(skipList.length > 0 ? { id: { notIn: skipList } } : {}),
    },
    orderBy: [{ readinessDeadline: 'asc' }, { createdAt: 'asc' }],
  });

  if (!article) {
    // Keep the engine running and poll again — new articles may arrive at any time.
    // Touch the record so stall detection sees fresh activity.
    await prisma.pipelineEngine.update({
      where: { id: engineId },
      data: { currentArticleId: null, currentStep: null },
    }).catch(() => {});  // swallow — poll must always be scheduled

    const skipped = skippedArticleIds[engineId].size;
    console.log(
      `[pipeline-engine/${engineId}] Queue empty${skipped > 0 ? ` (${skipped} skipped)` : ''} — will recheck in ${EMPTY_QUEUE_POLL_MS / 1000}s`,
    );

    setTimeout(
      () =>
        processNext(engineId, userId).catch((err) =>
          console.error(`[pipeline-engine/${engineId}] poll error:`, err),
        ),
      EMPTY_QUEUE_POLL_MS,
    );
    return;
  }

  // Claim the article
  await prisma.pipelineEngine.update({
    where: { id: engineId },
    data: { currentArticleId: article.id, currentStep: config.step },
  });

  const startedAt = new Date();
  const steps = [];
  let logStatus = 'completed';
  let error = null;

  try {
    await processArticleStep(engineId, article.id, userId, steps);
  } catch (err) {
    logStatus = 'failed';
    error = err?.message ?? 'Unknown error';
    console.error(`[pipeline-engine/${engineId}] Article ${article.id} failed:`, err);
    skippedArticleIds[engineId].add(article.id);
  }

  const now = new Date();

  // Step 1 — Release the claim. This MUST succeed for the chain to continue.
  // Use only fields that existed before the migration (id, status, currentArticleId,
  // currentStep, totalProcessed, totalFailed) so this never fails due to a stale
  // Prisma client that doesn't yet know about newer columns.
  try {
    await prisma.pipelineEngine.update({
      where: { id: engineId },
      data: {
        currentArticleId: null,
        currentStep: null,
        ...(logStatus === 'completed'
          ? { totalProcessed: { increment: 1 } }
          : { totalFailed: { increment: 1 } }),
      },
    });
  } catch (releaseErr) {
    console.error(`[pipeline-engine/${engineId}] CRITICAL: failed to release article claim:`, releaseErr);
    // Last resort — try bare minimum without counters
    await prisma.pipelineEngine.update({
      where: { id: engineId },
      data: { currentArticleId: null, currentStep: null },
    }).catch(() => {});
  }

  // Step 2 — Update lastJobCompletedAt (best-effort, new column may not exist on old client)
  prisma.pipelineEngine.update({
    where: { id: engineId },
    data: { lastJobCompletedAt: now },
  }).catch(() => {});

  // Step 3 — Write log entry (best-effort)
  prisma.pipelineEngineLog.create({
    data: {
      engineId,
      articleId: article.id,
      steps,
      status: logStatus,
      error,
      startedAt,
      completedAt: now,
    },
  }).catch((logErr) =>
    console.error(`[pipeline-engine/${engineId}] Log creation failed (non-fatal):`, logErr),
  );

  // Re-check status, then schedule next with rate-limit delay
  const updated = await prisma.pipelineEngine.findUnique({ where: { id: engineId } });
  if (!updated || updated.status !== 'running') return;

  const delayMs = (updated.delayMinutes ?? 0) * 60 * 1000;
  if (delayMs <= 0) {
    processNext(engineId, userId).catch((err) =>
      console.error(`[pipeline-engine/${engineId}] chain error:`, err),
    );
  } else {
    console.log(`[pipeline-engine/${engineId}] Rate limit: waiting ${updated.delayMinutes}m before next job`);
    setTimeout(
      () =>
        processNext(engineId, userId).catch((err) =>
          console.error(`[pipeline-engine/${engineId}] delayed chain error:`, err),
        ),
      delayMs,
    );
  }
}

// ---------------------------------------------------------------------------
// Per-engine step runners
// ---------------------------------------------------------------------------

async function processArticleStep(engineId, articleId, userId, steps) {
  switch (engineId) {
    case 'research':
      return processResearchStep(articleId, userId, steps);
    case 'writing':
      return processWritingStep(articleId, userId, steps);
    case 'images':
      return processAssetsStep(articleId, userId, steps);
    default:
      throw new Error(`Unknown engine: ${engineId}`);
  }
}

async function processResearchStep(articleId, userId, steps) {
  let article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) throw new Error('Article not found');

  // Reset stalled research to planning so triggerResearch starts cleanly
  if (article.status === 'research') {
    await prisma.article.update({ where: { id: articleId }, data: { status: 'planning' } });
  }

  await prisma.pipelineEngine.update({
    where: { id: 'research' },
    data: { currentStep: 'research' },
  });

  const result = await triggerResearch(articleId, userId);
  if (!result.ok) throw new Error(result.error ?? 'Research step failed');
  steps.push('research');
}

async function processWritingStep(articleId, userId, steps) {
  await prisma.pipelineEngine.update({
    where: { id: 'writing' },
    data: { currentStep: 'writing' },
  });

  const result = await triggerWriting(articleId, userId);
  if (!result.ok) throw new Error(result.error ?? 'Writing step failed');
  steps.push('writing');
}

async function processAssetsStep(articleId, userId, steps) {
  await prisma.pipelineEngine.update({
    where: { id: 'images' },
    data: { currentStep: 'assets' },
  });

  const result = await triggerAssets(articleId, userId);
  if (!result.ok) throw new Error(result.error ?? 'Assets step failed');
  steps.push('assets');

  // triggerAssets returns ok:true even when individual images fail.
  // If the article is still in 'assets' status, images didn't complete.
  const afterAssets = await prisma.article.findUnique({
    where: { id: articleId },
    select: { status: true },
  });
  if (afterAssets?.status === 'assets') {
    throw new Error(
      `Assets incomplete: ${result.failed ?? 0}/${result.total ?? 0} image(s) failed — article skipped until engine restarts`,
    );
  }
}
