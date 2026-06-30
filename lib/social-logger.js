/**
 * Lightweight pipeline logger for the social content pipeline.
 *
 * Usage pattern:
 *   const logId = await logStart(campaignId, 'approval_ai_send', 'Sending articles to approval agent', { message });
 *   // ... do work ...
 *   await logDone(logId, 'Agent returned 12 approved posts', { rawResponse });
 *   // on error:
 *   await logError(logId, error.message);
 */

import { prisma } from '@/lib/prisma';

/**
 * Create a "running" log row and return its ID.
 * Call this before the work starts so the UI shows a live spinner.
 */
export async function logStart(campaignId, step, message, input, postId) {
  try {
    const row = await prisma.socialCampaignLog.create({
      data: {
        campaignId,
        postId: postId ?? null,
        step,
        status: 'running',
        message,
        input: input ?? null,
      },
    });
    return row.id;
  } catch {
    // Never let logging break the pipeline
    return null;
  }
}

/**
 * Mark an existing log row as done and attach the output.
 */
export async function logDone(logId, message, output) {
  if (!logId) return;
  try {
    await prisma.socialCampaignLog.update({
      where: { id: logId },
      data: { status: 'done', message, output: output ?? null },
    });
  } catch {
    // silent
  }
}

/**
 * Mark an existing log row as error.
 */
export async function logError(logId, message, output) {
  if (!logId) return;
  try {
    await prisma.socialCampaignLog.update({
      where: { id: logId },
      data: { status: 'error', message, output: output ?? null },
    });
  } catch {
    // silent
  }
}

/**
 * One-shot: create a completed log row (for quick informational events).
 */
export async function logInfo(campaignId, step, message, data, postId) {
  try {
    await prisma.socialCampaignLog.create({
      data: {
        campaignId,
        postId: postId ?? null,
        step,
        status: 'done',
        message,
        output: data ?? null,
      },
    });
  } catch {
    // silent
  }
}
