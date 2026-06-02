import { prisma } from '@/lib/prisma';
import { contentLog } from '@/services/content-log.service';
import { createAttempt } from '@/services/ai-attempt.service';

const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// n8n Health Check
// ---------------------------------------------------------------------------

/**
 * Ping the n8n health workflow.
 * @returns {{ available: boolean; latency?: number; error?: string }}
 */
export async function checkN8nHealth() {
  const url = process.env.N8N_HEALTH_URL;
  if (!url) {
    return { available: false, error: 'N8N_HEALTH_URL not configured' };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET ?? '' },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { available: false, error: `n8n returned HTTP ${res.status}` };
    }
    return { available: true, latency: Date.now() - start };
  } catch (err) {
    return { available: false, error: err?.message ?? 'Unreachable' };
  }
}

// ---------------------------------------------------------------------------
// Topic Selection Algorithm
// ---------------------------------------------------------------------------

/**
 * Distribute count as evenly as possible across buckets.
 * Returns an array of allocations (one per bucket) that sums to total.
 * @param {number} total
 * @param {number} buckets
 * @returns {number[]}
 */
function distributeEvenly(total, buckets) {
  if (buckets === 0) return [];
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Interleave arrays in round-robin order.
 * e.g. interleave([[A,B],[C,D,E]]) → [A,C,B,D,E]
 * @param {any[][]} arrays
 * @returns {any[]}
 */
function interleaveRoundRobin(arrays) {
  const out = [];
  const maxLen = Math.max(...arrays.map((a) => a.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) out.push(arr[i]);
    }
  }
  return out;
}

/**
 * Select topics for a schedule and return slot descriptors.
 *
 * Algorithm:
 *  1. Load active topics under selected sections/categories (excluding excluded)
 *  2. Load article counts per topic
 *  3. Distribute totalSlots across sections evenly
 *  4. Within each section, distribute across categories evenly
 *  5. Within each category, pick topics by lowest article count (ties: random)
 *  6. Assign dates using day-round-robin per section
 *
 * @param {{
 *   startDate: string;
 *   endDate: string;
 *   postsPerDay: number;
 *   sectionIds: string[];
 *   categoryIds: string[];
 *   excludeTopicIds?: string[];
 * }} input
 * @returns {Promise<Array<{ sectionId: string|null; categoryId: string; topicId: string; scheduledDate: Date }>>}
 */
export async function selectTopicsForSchedule(input) {
  const {
    startDate,
    endDate,
    postsPerDay,
    sectionIds = [],
    categoryIds = [],
    excludeTopicIds = [],
  } = input;

  // Build date range (array of Date objects at UTC noon for each day)
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setUTCHours(12, 0, 0, 0);
  end.setUTCHours(12, 0, 0, 0);

  const days = [];
  let cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur = new Date(cur.getTime() + MS_PER_DAY);
  }

  const numDays = days.length;
  const totalSlots = numDays * postsPerDay;

  // Load categories with their topics and section info
  const where = {};
  if (categoryIds.length > 0) {
    where.id = { in: categoryIds };
  }
  if (sectionIds.length > 0) {
    where.sectionId = { in: sectionIds };
  }

  const categories = await prisma.category.findMany({
    where: { ...where, status: 'active' },
    include: {
      section: { select: { id: true, name: true } },
      topics: {
        where: {
          status: 'active',
          ...(excludeTopicIds.length > 0 ? { id: { notIn: excludeTopicIds } } : {}),
        },
        include: { _count: { select: { articles: true } } },
      },
    },
  });

  // Filter to only categories that have at least one eligible topic
  const activeCats = categories.filter((c) => c.topics.length > 0);
  if (activeCats.length === 0) return [];

  // Group categories by section
  const sectionMap = new Map();
  for (const cat of activeCats) {
    const sid = cat.sectionId ?? '__no_section__';
    if (!sectionMap.has(sid)) {
      sectionMap.set(sid, { sectionId: cat.sectionId, categories: [] });
    }
    sectionMap.get(sid).categories.push(cat);
  }

  const sections = [...sectionMap.values()];
  const sectionAllocs = distributeEvenly(totalSlots, sections.length);

  // Step 1 — collect topic assignments per section WITHOUT dates yet.
  const slotsBySectionIndex = sections.map((section, sIdx) => {
    const sectionSlotCount = sectionAllocs[sIdx];
    const catAllocs = distributeEvenly(sectionSlotCount, section.categories.length);
    const sectionSlots = [];

    section.categories.forEach((cat, cIdx) => {
      const catSlotCount = catAllocs[cIdx];

      // Sort topics by article count (ascending), shuffle ties
      const sorted = [...cat.topics].sort((a, b) => {
        const diff = a._count.articles - b._count.articles;
        if (diff !== 0) return diff;
        return Math.random() - 0.5;
      });

      for (let i = 0; i < catSlotCount; i++) {
        const topic = sorted[i % sorted.length];
        sectionSlots.push({
          sectionId: cat.sectionId ?? null,
          categoryId: cat.id,
          topicId: topic.id,
        });
      }
    });

    return sectionSlots;
  });

  // Step 2 — interleave sections round-robin so they are spread across days.
  const orderedSlots = interleaveRoundRobin(slotsBySectionIndex);

  // Step 3 — build a global date pool: each day repeated postsPerDay times.
  // This guarantees every calendar day gets exactly postsPerDay slots and no
  // weekday is ever skipped due to stride arithmetic.
  const datePool = days.flatMap((d) => Array(postsPerDay).fill(d));

  // Step 4 — zip slots with dates (trim either side if counts diverge due to
  // rounding, which should not normally happen but is safe to guard).
  const slots = orderedSlots.slice(0, datePool.length).map((s, i) => ({
    ...s,
    scheduledDate: datePool[i],
  }));

  // Sort by date so callers get a chronological list.
  slots.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  return slots;
}

// ---------------------------------------------------------------------------
// Preview (no DB writes)
// ---------------------------------------------------------------------------

/**
 * @param {object} input — same as selectTopicsForSchedule
 * @returns {Promise<Array<{ sectionId: string|null; categoryId: string; topicId: string; scheduledDate: Date }>>}
 */
export async function previewSchedule(input) {
  return selectTopicsForSchedule(input);
}

// ---------------------------------------------------------------------------
// Create Batch
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   name: string;
 *   startDate: string;
 *   endDate: string;
 *   postsPerDay: number;
 *   sectionIds: string[];
 *   categoryIds: string[];
 *   excludeTopicIds?: string[];
 * }} input
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function createScheduleBatch(input, opts = {}) {
  const slots = await selectTopicsForSchedule(input);
  if (slots.length === 0) {
    const err = new Error('No eligible topics found for the given configuration');
    err.code = 'VALIDATION';
    throw err;
  }

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);

  return prisma.$transaction(async (tx) => {
    const batch = await tx.scheduleBatch.create({
      data: {
        name: input.name,
        startDate: start,
        endDate: end,
        postsPerDay: input.postsPerDay,
        sectionIds: input.sectionIds ?? [],
        categoryIds: input.categoryIds ?? [],
        excludeTopicIds: input.excludeTopicIds ?? [],
        totalSlots: slots.length,
        createdBy: opts.createdBy ?? null,
      },
    });

    // Create all slots — position preserves the intended intra-day ordering
    await tx.scheduledArticleSlot.createMany({
      data: slots.map((s, index) => ({
        batchId: batch.id,
        sectionId: s.sectionId,
        categoryId: s.categoryId,
        topicId: s.topicId,
        scheduledDate: s.scheduledDate,
        position: index,
      })),
    });

    await contentLog(
      {
        type: 'scheduler',
        action: 'create',
        message: `Schedule batch "${batch.name}" created with ${slots.length} slots`,
        entityType: 'schedule_batch',
        entityId: batch.id,
        metadata: { totalSlots: slots.length, postsPerDay: input.postsPerDay },
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );

    return batch;
  });
}

// ---------------------------------------------------------------------------
// Get Batches
// ---------------------------------------------------------------------------

export async function getScheduleBatches() {
  return prisma.scheduleBatch.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { slots: true } },
    },
  });
}

/**
 * @param {string} id
 */
export async function getScheduleBatchById(id) {
  return prisma.scheduleBatch.findUnique({
    where: { id },
    include: {
      slots: {
        orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
        include: {
          // Resolve names via category → section relations
        },
      },
    },
  });
}

/**
 * Full batch with slot relations for detail page.
 * @param {string} id
 */
export async function getScheduleBatchDetail(id) {
  const batch = await prisma.scheduleBatch.findUnique({
    where: { id },
  });
  if (!batch) return null;

  const slots = await prisma.scheduledArticleSlot.findMany({
    where: { batchId: id },
    orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
  });

  // Load category + section + topic names in bulk
  const catIds = [...new Set(slots.map((s) => s.categoryId))];
  const topicIds = [...new Set(slots.map((s) => s.topicId))];
  const sectionIds = [...new Set(slots.map((s) => s.sectionId).filter(Boolean))];

  const [categories, topics, sections] = await Promise.all([
    prisma.category.findMany({
      where: { id: { in: catIds } },
      select: { id: true, name: true, sectionId: true },
    }),
    prisma.topic.findMany({
      where: { id: { in: topicIds } },
      select: { id: true, name: true, categoryId: true },
    }),
    sectionIds.length > 0
      ? prisma.section.findMany({
          where: { id: { in: sectionIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const topicMap = Object.fromEntries(topics.map((t) => [t.id, t]));
  const sectionMap = Object.fromEntries(sections.map((s) => [s.id, s]));

  const enrichedSlots = slots.map((slot) => ({
    ...slot,
    categoryName: catMap[slot.categoryId]?.name ?? null,
    topicName: topicMap[slot.topicId]?.name ?? null,
    sectionName: slot.sectionId ? (sectionMap[slot.sectionId]?.name ?? null) : null,
  }));

  // Load activity logs for batch + all slots
  const slotIds = slots.map((s) => s.id);
  const logs = await prisma.contentLog.findMany({
    where: {
      OR: [
        { entityType: 'schedule_batch', entityId: id },
        ...(slotIds.length > 0
          ? [{ entityType: 'schedule_slot', entityId: { in: slotIds } }]
          : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return { batch, slots: enrichedSlots, logs };
}

/**
 * Lightweight slot list for calendar (only planned+ statuses with dates).
 */
export async function getScheduledSlotsForCalendar() {
  const slots = await prisma.scheduledArticleSlot.findMany({
    orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
    select: {
      id: true,
      batchId: true,
      articleId: true,
      sectionId: true,
      categoryId: true,
      topicId: true,
      scheduledDate: true,
      status: true,
    },
  });

  if (slots.length === 0) return [];

  const topicIds = [...new Set(slots.map((s) => s.topicId))];
  const topics = await prisma.topic.findMany({
    where: { id: { in: topicIds } },
    select: { id: true, name: true },
  });
  const topicMap = Object.fromEntries(topics.map((t) => [t.id, t]));

  return slots.map((s) => ({
    ...s,
    topicName: topicMap[s.topicId]?.name ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Trigger Batch (chain execution)
// ---------------------------------------------------------------------------

/**
 * Starts or resumes a batch. Triggers only the first planned slot.
 * @param {string} batchId
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function triggerBatchGeneration(batchId, opts = {}) {
  const batch = await prisma.scheduleBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    const err = new Error('Batch not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Set batch running; preserve original startedAt on resume
  await prisma.scheduleBatch.update({
    where: { id: batchId },
    data: {
      status: 'running',
      pauseReason: null,
      ...(batch.startedAt == null ? { startedAt: new Date() } : {}),
    },
  });

  await contentLog({
    type: 'scheduler',
    action: 'resume',
    message: `Batch "${batch.name}" started`,
    entityType: 'schedule_batch',
    entityId: batchId,
    createdBy: opts.createdBy ?? null,
  });

  // Find first planned slot
  const firstSlot = await prisma.scheduledArticleSlot.findFirst({
    where: { batchId, status: 'planned' },
    orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
  });

  if (!firstSlot) {
    // No planned slots — mark complete
    await prisma.scheduleBatch.update({
      where: { id: batchId },
      data: { status: 'completed', completedAt: new Date() },
    });
    return { started: true, noSlots: true };
  }

  const result = await triggerSlotGeneration(firstSlot.id, opts);
  return { started: true, ...result };
}

// ---------------------------------------------------------------------------
// Trigger Single Slot
// ---------------------------------------------------------------------------

/**
 * @param {string} slotId
 * @param {{ createdBy?: string | null; isRedo?: boolean }} [opts]
 * @returns {Promise<{ paused?: boolean; sent?: boolean }>}
 */
export async function triggerSlotGeneration(slotId, opts = {}) {
  const slot = await prisma.scheduledArticleSlot.findUnique({
    where: { id: slotId },
    include: {
      batch: true,
    },
  });
  if (!slot) {
    const err = new Error('Slot not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // n8n health check — auto-pause on failure
  const health = await checkN8nHealth();
  if (!health.available) {
    await prisma.scheduleBatch.update({
      where: { id: slot.batchId },
      data: { status: 'paused', pauseReason: 'n8n_unavailable' },
    });
    await contentLog({
      type: 'scheduler',
      action: 'auto_pause',
      message: `Batch auto-paused — n8n unreachable: ${health.error}`,
      entityType: 'schedule_batch',
      entityId: slot.batchId,
      metadata: { error: health.error, slotId },
      createdBy: opts.createdBy ?? null,
    });
    return { paused: true, reason: 'n8n_unavailable' };
  }

  // Load full slot context for payload
  const [category, topic] = await Promise.all([
    prisma.category.findUnique({
      where: { id: slot.categoryId },
      include: { section: true },
    }),
    prisma.topic.findUnique({
      where: { id: slot.topicId },
      include: {
        articles: {
          select: { title: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    }),
  ]);

  const section = category?.section ?? null;
  const scheduledDateStr = slot.scheduledDate.toISOString().split('T')[0];

  const payload = {
    slotId: slot.id,
    batchId: slot.batchId,
    scheduledDate: scheduledDateStr,
    section: section
      ? {
          id: section.id,
          name: section.name,
          description: section.description ?? null,
          characterName: section.characterName ?? null,
          characterBiography: section.characterBiography ?? null,
          characterPersona: section.characterPersona ?? null,
          characterImage: section.characterImage ?? null,
        }
      : null,
    category: category
      ? { id: category.id, name: category.name, description: category.description ?? null }
      : null,
    topic: topic
      ? {
          id: topic.id,
          name: topic.name,
          description: topic.description ?? null,
          targetKeyword: topic.targetKeyword ?? null,
        }
      : null,
    existingArticleCount: topic?._count?.articles ?? topic?.articles?.length ?? 0,
    existingArticleTitles: topic?.articles?.map((a) => a.title) ?? [],
    requestedOutputFields: [
      'title',
      'summary',
      'articleAngle',
      'featuredImagePrompt',
      'inlineImagePrompts',
      'videoIdea',
      'seoKeywords',
      'outline',
      'recommendedStatus',
    ],
    instruction:
      'Generate a unique article plan for this topic. Avoid duplicating existing titles listed in existingArticleTitles.',
    callbackUrl: `${(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/api/webhooks/n8n/article-planning`,
    webhookSecret: process.env.N8N_WEBHOOK_SECRET ?? '',
  };

  // Send to n8n and wait for synchronous response
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  let n8nExecutionId = null;

  if (n8nUrl) {
    // Mark slot as in-flight
    await prisma.scheduledArticleSlot.update({
      where: { id: slotId },
      data: { status: 'sent_to_n8n', triggeredAt: new Date() },
    });

    try {
      const res = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET ?? '',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        let json = null;
        try { json = await res.json(); } catch { /* no-op */ }

        n8nExecutionId = json?.executionId ?? json?.n8nExecutionId ?? null;

        // Synchronous mode: n8n returns the article plan directly in the response.
        // Process it here instead of waiting for a separate webhook callback.
        if (json && (json.success === true || json.success === false)) {
          await updateSlotFromWebhook(
            { ...json, slotId },
            { createdBy: opts.createdBy ?? null, isRedo: opts.isRedo ?? false },
          );
          return { sent: true, processed: true };
        }
      }
    } catch (fetchErr) {
      await prisma.scheduleBatch.update({
        where: { id: slot.batchId },
        data: { status: 'paused', pauseReason: 'n8n_unavailable' },
      });
      await contentLog({
        type: 'scheduler',
        action: 'auto_pause',
        message: `Batch auto-paused — n8n trigger failed: ${fetchErr?.message}`,
        entityType: 'schedule_batch',
        entityId: slot.batchId,
        metadata: { error: fetchErr?.message, slotId },
        createdBy: opts.createdBy ?? null,
      });
      createAttempt({
        type: 'planning',
        slotId,
        prompt: JSON.stringify(payload),
        result: fetchErr?.message ?? 'n8n unreachable',
        model: 'n8n/planning',
        status: 'failed',
        isRedo: opts.isRedo ?? false,
        triggeredBy: opts.createdBy ? 'user' : 'system',
      }).catch(() => {});
      return { paused: true, reason: 'n8n_trigger_failed' };
    }
  }

  await contentLog({
    type: 'scheduler',
    action: 'trigger',
    message: `Slot sent to n8n — topic: ${topic?.name ?? slotId}`,
    entityType: 'schedule_slot',
    entityId: slotId,
    metadata: { batchId: slot.batchId, scheduledDate: scheduledDateStr },
    createdBy: opts.createdBy ?? null,
  });

  return { sent: true };
}

// ---------------------------------------------------------------------------
// Stop Batch
// ---------------------------------------------------------------------------

/**
 * @param {string} batchId
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function stopBatch(batchId, opts = {}) {
  const batch = await prisma.scheduleBatch.findUnique({ where: { id: batchId } });
  if (!batch) {
    const err = new Error('Batch not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  await prisma.scheduleBatch.update({
    where: { id: batchId },
    data: { status: 'paused', pauseReason: 'manual' },
  });
  await contentLog({
    type: 'scheduler',
    action: 'stop',
    message: `Batch "${batch.name}" stopped manually`,
    entityType: 'schedule_batch',
    entityId: batchId,
    createdBy: opts.createdBy ?? null,
  });
  return { stopped: true };
}

// ---------------------------------------------------------------------------
// Webhook Receiver
// ---------------------------------------------------------------------------

/**
 * Process the result from n8n for a single slot.
 * Stores planningData on the slot — does NOT create an Article.
 * Articles are created manually via promoteSlotToArticle().
 * @param {object} data — n8n webhook body
 * @param {{ createdBy?: string | null; isRedo?: boolean }} [opts]
 */
export async function updateSlotFromWebhook(data, opts = {}) {
  const { slotId, success, error: slotError } = data;
  if (!slotId) {
    const err = new Error('slotId is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const slot = await tx.scheduledArticleSlot.findUnique({
      where: { id: slotId },
      include: { batch: true },
    });
    if (!slot) {
      const err = new Error('Slot not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Store the full AI planning payload on the slot (no article created here)
    const slotPlanningData = success
      ? {
          title: data.title,
          summary: data.summary,
          articleAngle: data.articleAngle,
          featuredImagePrompt: data.featuredImagePrompt,
          inlineImagePrompts: data.inlineImagePrompts,
          videoIdea: data.videoIdea,
          seoKeywords: data.seoKeywords,
          outline: data.outline,
          recommendedStatus: data.recommendedStatus,
        }
      : null;

    await tx.scheduledArticleSlot.update({
      where: { id: slotId },
      data: {
        status: success ? 'completed' : 'failed',
        completedAt: now,
        planningData: slotPlanningData ?? undefined,
        errorMessage: success ? null : (slotError ?? 'Unknown error'),
      },
    });

    // Update batch counters
    const newCompleted = success
      ? slot.batch.completedSlots + 1
      : slot.batch.completedSlots;
    const newFailed = success
      ? slot.batch.failedSlots
      : slot.batch.failedSlots + 1;
    const isDone = newCompleted + newFailed >= slot.batch.totalSlots;

    await tx.scheduleBatch.update({
      where: { id: slot.batchId },
      data: {
        completedSlots: newCompleted,
        failedSlots: newFailed,
        ...(isDone ? { status: 'completed', completedAt: now } : {}),
      },
    });

    await contentLog(
      {
        type: 'scheduler',
        action: 'webhook',
        message: success
          ? `Slot completed — plan ready to promote`
          : `Webhook received — slot failed: ${slotError ?? 'unknown'}`,
        entityType: 'schedule_slot',
        entityId: slotId,
        metadata: { success, batchId: slot.batchId },
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );

    return { batch: slot.batch, isDone, batchId: slot.batchId };
  });

  // Log the planning attempt
  createAttempt({
    type: 'planning',
    slotId: data.slotId,
    prompt: data.instruction ?? 'Article planning',
    result: success
      ? (data.title ?? JSON.stringify({ title: data.title, articleAngle: data.articleAngle }))
      : (data.error ?? 'Planning failed'),
    model: 'n8n/planning',
    status: success ? 'success' : 'failed',
    isRedo: opts.isRedo ?? false,
    triggeredBy: opts.createdBy ? 'user' : 'system',
  }).catch(() => {});

  // Chain next slot if batch is still running
  if (!result.isDone) {
    const freshBatch = await prisma.scheduleBatch.findUnique({
      where: { id: result.batchId },
    });
    if (freshBatch?.status === 'running') {
      const nextSlot = await prisma.scheduledArticleSlot.findFirst({
        where: { batchId: result.batchId, status: 'planned' },
        orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
      });
      if (nextSlot) {
        // Fire and forget — do not await to keep webhook response fast
        triggerSlotGeneration(nextSlot.id, opts).catch((err) => {
          console.error('[scheduler] chain trigger failed:', err);
        });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Promote Slot → Article
// ---------------------------------------------------------------------------

/**
 * Create an Article from a completed slot's planningData and link them.
 * Idempotent: if the slot already has an articleId, returns the existing article.
 * @param {string} slotId
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function promoteSlotToArticle(slotId, opts = {}) {
  const slot = await prisma.scheduledArticleSlot.findUnique({
    where: { id: slotId },
  });
  if (!slot) {
    const err = new Error('Slot not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (slot.status !== 'completed') {
    const err = new Error('Only completed slots can be promoted to articles');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!slot.planningData) {
    const err = new Error('Slot has no planning data to promote');
    err.code = 'VALIDATION';
    throw err;
  }

  // Idempotency: return early if already promoted
  if (slot.articleId) {
    const existing = await prisma.article.findUnique({ where: { id: slot.articleId } });
    if (existing) return existing;
  }

  const plan = slot.planningData;

  const ARTICLE_STATUS_VALID = new Set([
    'planning', 'research', 'writing', 'assets',
    'approval', 'scheduling', 'publishing', 'post_publish',
  ]);
  const recStatus = ARTICLE_STATUS_VALID.has(plan.recommendedStatus)
    ? plan.recommendedStatus
    : 'planning';

  const publishDate = slot.scheduledDate;
  const readinessDeadline = new Date(publishDate.getTime() - 7 * MS_PER_DAY);

  return prisma.$transaction(async (tx) => {
    const article = await tx.article.create({
      data: {
        title: plan.title ?? `Scheduled: ${slotId}`,
        summary: plan.summary ?? null,
        topicId: slot.topicId,
        categoryId: slot.categoryId,
        status: recStatus,
        publishDate,
        readinessDeadline,
        scheduleBatchId: slot.batchId,
        scheduledSlotId: slot.id,
        generationSource: 'scheduler',
        // AI planning fields
        articleAngle: plan.articleAngle ?? null,
        seoKeywords: Array.isArray(plan.seoKeywords) ? plan.seoKeywords : [],
        outline: plan.outline ?? null,
        featuredImagePrompt: plan.featuredImagePrompt ?? null,
        inlineImagePrompts: plan.inlineImagePrompts ?? null,
        videoIdea: plan.videoIdea ?? null,
      },
    });

    // Link slot → article
    await tx.scheduledArticleSlot.update({
      where: { id: slotId },
      data: { articleId: article.id },
    });

    await contentLog(
      {
        type: 'scheduler',
        action: 'promote',
        message: `Slot promoted — article "${article.title}" created`,
        entityType: 'article',
        entityId: article.id,
        metadata: { slotId, batchId: slot.batchId },
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );

    return article;
  });
}

// ---------------------------------------------------------------------------
// Revoke Slot Article
// ---------------------------------------------------------------------------

/**
 * Unlinks a promoted article from its slot and deletes the article.
 * The slot returns to `completed` status with its planningData intact so it
 * can be promoted again.
 * @param {string} slotId
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function revokeSlotArticle(slotId, opts = {}) {
  const slot = await prisma.scheduledArticleSlot.findUnique({
    where: { id: slotId },
  });
  if (!slot) {
    const err = new Error('Slot not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!slot.articleId) {
    const err = new Error('Slot has no linked article to revoke');
    err.code = 'VALIDATION';
    throw err;
  }

  const articleId = slot.articleId;

  return prisma.$transaction(async (tx) => {
    // Unlink first (FK constraint)
    await tx.scheduledArticleSlot.update({
      where: { id: slotId },
      data: { articleId: null },
    });

    // Delete the article (also clears Article.scheduledSlotId reference)
    await tx.article.delete({ where: { id: articleId } });

    await contentLog(
      {
        type: 'scheduler',
        action: 'revoke',
        message: `Article revoked and deleted from slot`,
        entityType: 'schedule_slot',
        entityId: slotId,
        metadata: { articleId, batchId: slot.batchId },
        createdBy: opts.createdBy ?? null,
      },
      tx,
    );

    return { revoked: true, articleId };
  });
}

// ---------------------------------------------------------------------------
// Retry Slot
// ---------------------------------------------------------------------------

/**
 * Reset a failed slot to planned and re-trigger it.
 * @param {string} slotId
 * @param {{ createdBy?: string | null }} [opts]
 */
export async function retrySlot(slotId, opts = {}) {
  await prisma.scheduledArticleSlot.update({
    where: { id: slotId },
    data: {
      status: 'planned',
      errorMessage: null,
      triggeredAt: null,
      completedAt: null,
      n8nExecutionId: null,
    },
  });

  await contentLog({
    type: 'scheduler',
    action: 'retry',
    message: `Slot retry initiated`,
    entityType: 'schedule_slot',
    entityId: slotId,
    createdBy: opts.createdBy ?? null,
  });

  return triggerSlotGeneration(slotId, { ...opts, isRedo: true });
}

/**
 * Redo a slot regardless of current status (including completed).
 * Clears all previous results and re-triggers AI generation.
 * The previously generated article is unlinked but not deleted.
 */
export async function redoSlot(slotId, opts = {}) {
  await prisma.scheduledArticleSlot.update({
    where: { id: slotId },
    data: {
      status: 'planned',
      articleId: null,
      planningData: null,
      errorMessage: null,
      triggeredAt: null,
      completedAt: null,
      n8nExecutionId: null,
    },
  });

  await contentLog({
    type: 'scheduler',
    action: 'redo',
    message: `Slot regeneration initiated`,
    entityType: 'schedule_slot',
    entityId: slotId,
    createdBy: opts.createdBy ?? null,
  });

  return triggerSlotGeneration(slotId, { ...opts, isRedo: true });
}
