import { prisma } from '@/lib/prisma';
import { triggerResearch, triggerWriting, triggerAssets } from '@/services/article-automation.service';
import { runSeoOptimization } from '@/services/seo-ai.service';
import { runKingsgateLinkingBatch } from '@/services/kingsgate-linking.service';
import { contentLog } from '@/services/content-log.service';

// ---------------------------------------------------------------------------
// Engine configuration
// ---------------------------------------------------------------------------

export const ENGINE_IDS = ['research', 'writing', 'images', 'seo', 'kingsgate-linking'];

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
  // Every article, one at a time, once it's published — on-page SEO only
  // (meta description, title, headings, keyword placement, citability). No
  // linking decision happens here at all; see 'kingsgate-linking' below.
  seo: {
    label: 'SEO Engine',
    queueStatuses: ['post_publish'],
    extraWhere: { seoOptimized: false },
    step: 'seo',
  },
  // Batch-of-N comparative selection, only after an article has already been
  // through the 'seo' engine. Strictly waits for a full batch (see
  // processNext's batchSize branch) rather than ever processing a partial one.
  'kingsgate-linking': {
    label: 'Kingsgate Linking Engine',
    queueStatuses: ['post_publish'],
    extraWhere: { seoOptimized: true, linkReviewed: false },
    batchSize: 10,
    step: 'kingsgate-linking',
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
  seo: new Set(),
  'kingsgate-linking': new Set(),
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
  const isWaiting =
    engine.status === 'running' &&
    !engine.currentArticleId &&
    !(engine.currentBatchArticleIds?.length > 0);

  let nextRunMs = null;
  if (engine.status === 'running' && engine.delayMinutes > 0 && engine.lastJobCompletedAt) {
    const delayMs = engine.delayMinutes * 60 * 1000;
    const elapsed = Date.now() - new Date(engine.lastJobCompletedAt).getTime();
    nextRunMs = Math.max(0, delayMs - elapsed);
  }

  return { ...engine, isStalled, isWaiting, nextRunMs };
}

/** Build the Prisma `where` clause for an engine's queue, honoring extraWhere + skip list. */
function buildQueueWhere(config, skipList) {
  return {
    status: { in: config.queueStatuses },
    ...(config.extraWhere ?? {}),
    ...(skipList.length > 0 ? { id: { notIn: skipList } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the status of all engines plus the combined (research/writing/images) queue.
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

  // Build engines map, fetching current article(s) + a fresh queue count for each engine
  const engineMap = {};
  await Promise.all(
    ENGINE_IDS.map(async (id) => {
      const config = ENGINE_CONFIGS[id];
      const row = engineRows.find((e) => e.id === id) ?? {
        id,
        status: 'idle',
        totalProcessed: 0,
        totalFailed: 0,
        delayMinutes: 0,
        lastJobCompletedAt: null,
        currentArticleId: null,
        currentBatchArticleIds: [],
        currentStep: null,
        pauseReason: null,
        updatedAt: new Date(),
      };
      const enriched = enrichEngine(row);

      const [currentArticle, currentBatchArticles, queueCount] = await Promise.all([
        row.currentArticleId
          ? prisma.article.findUnique({
              where: { id: row.currentArticleId },
              select: { id: true, title: true, status: true, category: { select: { name: true } } },
            })
          : null,
        row.currentBatchArticleIds?.length
          ? prisma.article.findMany({
              where: { id: { in: row.currentBatchArticleIds } },
              select: { id: true, title: true },
            })
          : [],
        prisma.article.count({
          where: buildQueueWhere(config, [...skippedArticleIds[id]]),
        }),
      ]);

      engineMap[id] = { ...enriched, currentArticle, currentBatchArticles, queueCount };
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

  // Same "crashed mid-flight" cleanup for the two SEO engines' own audit tables.
  const [failedSeoRuns, failedLinkingRuns] = await Promise.all([
    prisma.seoOptimizationRun.updateMany({
      where: { status: 'running' },
      data: {
        status: 'failed',
        errorMessage: 'Interrupted — server restarted or engine was stopped',
        updatedAt: new Date(),
      },
    }).catch(() => ({ count: 0 })),
    prisma.kingsgateLinkingBatchRun.updateMany({
      where: { status: 'running' },
      data: {
        status: 'failed',
        errorMessage: 'Interrupted — server restarted or engine was stopped',
        updatedAt: new Date(),
      },
    }).catch(() => ({ count: 0 })),
  ]);

  const total = resetAssets.count + failedRuns.count + failedSeoRuns.count + failedLinkingRuns.count;
  if (total > 0) {
    console.log(
      `[pipeline-engine] Stale cleanup: ${resetAssets.count} asset(s) unblocked, ${failedRuns.count} automation run(s) cleared, ${failedSeoRuns.count} SEO run(s) cleared, ${failedLinkingRuns.count} linking batch(es) cleared`,
    );
    await contentLog({
      type: 'system',
      action: 'automation',
      message: `Engine startup cleanup: ${resetAssets.count} stuck asset(s) unblocked, ${failedRuns.count + failedSeoRuns.count + failedLinkingRuns.count} zombie run(s) cleared`,
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

  // Only cleanup on first engine start (avoid redundant cleanup on each start)
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
    update: {
      status: 'running',
      pauseReason: null,
      currentArticleId: null,
      currentBatchArticleIds: [],
      currentStep: null,
    },
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
 * Pause a specific engine. Stops after the current article's (or batch's) step finishes.
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
 * Fire-and-forget: find the next article (or, for batch-style engines, the
 * next full batch) for this engine, run its step, then schedule itself again
 * (respecting delayMinutes rate limit).
 */
export async function processNext(engineId, userId) {
  const engine = await prisma.pipelineEngine.findUnique({ where: { id: engineId } });
  if (!engine || engine.status !== 'running') return;

  // Concurrency guard: if a claim is already held, another processNext chain
  // is actively mid-step for this engine. Bail to avoid double-processing.
  // (startEngine clears claims before firing, so this only blocks genuine
  //  concurrent calls, not stale values from a previous session.)
  if (engine.currentArticleId || engine.currentBatchArticleIds?.length > 0) {
    console.log(`[pipeline-engine/${engineId}] Already in progress — exiting duplicate chain`);
    return;
  }

  const config = ENGINE_CONFIGS[engineId];
  const skipList = [...skippedArticleIds[engineId]];
  const where = buildQueueWhere(config, skipList);

  if (config.batchSize) {
    return processNextBatch(engineId, userId, config, where);
  }
  return processNextSingle(engineId, userId, config, where);
}

/** Single-article engines (research/writing/images/seo) — unchanged shape from before batching was added. */
async function processNextSingle(engineId, userId, config, where) {
  const article = await prisma.article.findFirst({
    where,
    orderBy: [{ readinessDeadline: 'asc' }, { createdAt: 'asc' }],
  });

  if (!article) {
    await goIdleAndPoll(engineId, userId);
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

  await releaseClaimAndContinue(engineId, userId, {
    logStatus,
    release: { currentArticleId: null, currentStep: null },
    logRows: [{ articleId: article.id, steps, status: logStatus, error, startedAt }],
  });
}

/** Batch-style engines (kingsgate-linking) — strictly waits for a FULL batch before claiming. */
async function processNextBatch(engineId, userId, config, where) {
  const count = await prisma.article.count({ where });

  if (count < config.batchSize) {
    // Not enough eligible articles yet — behave exactly like an empty queue
    // rather than ever processing a partial batch.
    await goIdleAndPoll(engineId, userId);
    return;
  }

  const articles = await prisma.article.findMany({
    where,
    orderBy: [{ readinessDeadline: 'asc' }, { createdAt: 'asc' }],
    take: config.batchSize,
  });
  const articleIds = articles.map((a) => a.id);

  // Claim the whole batch
  await prisma.pipelineEngine.update({
    where: { id: engineId },
    data: { currentBatchArticleIds: articleIds, currentStep: config.step },
  });

  const startedAt = new Date();
  let logStatus = 'completed';
  let error = null;

  try {
    await processBatchStep(engineId, articleIds, userId);
  } catch (err) {
    logStatus = 'failed';
    error = err?.message ?? 'Unknown error';
    console.error(`[pipeline-engine/${engineId}] Batch [${articleIds.join(', ')}] failed:`, err);
    articleIds.forEach((id) => skippedArticleIds[engineId].add(id));
  }

  // One PipelineEngineLog row per article in the batch (same startedAt/status)
  // so the shared "History" tab stays useful without a schema change to make
  // PipelineEngineLog.articleId nullable/plural.
  await releaseClaimAndContinue(engineId, userId, {
    logStatus,
    release: { currentBatchArticleIds: [], currentStep: null },
    logRows: articleIds.map((articleId) => ({
      articleId,
      steps: [config.step],
      status: logStatus,
      error,
      startedAt,
    })),
  });
}

/** Shared "queue is empty" handling — keeps the engine running and polls again. */
async function goIdleAndPoll(engineId, userId) {
  // Touch the record so stall detection sees fresh activity.
  await prisma.pipelineEngine.update({
    where: { id: engineId },
    data: { currentArticleId: null, currentBatchArticleIds: [], currentStep: null },
  }).catch(() => {}); // swallow — poll must always be scheduled

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
}

/**
 * Shared tail of processNext, for both single and batch engines:
 * release the claim, bump counters, write log row(s), then schedule the next
 * run (respecting the rate-limit delay).
 */
async function releaseClaimAndContinue(engineId, userId, { logStatus, release, logRows }) {
  // Step 1 — Release the claim. This MUST succeed for the chain to continue.
  try {
    await prisma.pipelineEngine.update({
      where: { id: engineId },
      data: {
        ...release,
        ...(logStatus === 'completed'
          ? { totalProcessed: { increment: 1 } }
          : { totalFailed: { increment: 1 } }),
      },
    });
  } catch (releaseErr) {
    console.error(`[pipeline-engine/${engineId}] CRITICAL: failed to release claim:`, releaseErr);
    // Last resort — try bare minimum without counters
    await prisma.pipelineEngine.update({
      where: { id: engineId },
      data: release,
    }).catch(() => {});
  }

  const now = new Date();

  // Step 2 — Update lastJobCompletedAt (best-effort)
  prisma.pipelineEngine.update({
    where: { id: engineId },
    data: { lastJobCompletedAt: now },
  }).catch(() => {});

  // Step 3 — Write log entries (best-effort)
  Promise.all(
    logRows.map((row) =>
      prisma.pipelineEngineLog.create({
        data: { engineId, ...row, completedAt: now },
      }),
    ),
  ).catch((logErr) =>
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
    case 'seo':
      return processSeoStep(articleId, userId, steps);
    default:
      throw new Error(`Unknown single-article engine: ${engineId}`);
  }
}

async function processBatchStep(engineId, articleIds, userId) {
  switch (engineId) {
    case 'kingsgate-linking':
      return processKingsgateLinkingStep(articleIds, userId);
    default:
      throw new Error(`Unknown batch engine: ${engineId}`);
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

async function processSeoStep(articleId, userId, steps) {
  await prisma.pipelineEngine.update({
    where: { id: 'seo' },
    data: { currentStep: 'seo' },
  });

  const result = await runSeoOptimization(articleId, userId);
  if (!result.ok) throw new Error(result.error ?? 'SEO optimization failed');
  steps.push('seo');
}

async function processKingsgateLinkingStep(articleIds, userId) {
  await prisma.pipelineEngine.update({
    where: { id: 'kingsgate-linking' },
    data: { currentStep: 'kingsgate-linking' },
  });

  const result = await runKingsgateLinkingBatch(articleIds, userId);
  if (!result.ok) throw new Error(result.error ?? 'Kingsgate linking batch failed');
}
