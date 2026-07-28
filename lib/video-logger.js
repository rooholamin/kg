/**
 * Lightweight pipeline logger for the video campaign pipeline. Mirrors
 * lib/social-logger.js exactly, pointed at VideoCampaignLog instead.
 *
 * Usage pattern:
 *   const logId = await logStart(campaignId, 'director_ai_send', 'Sending article to director agent', { message });
 *   // ... do work ...
 *   await logDone(logId, 'Agent returned a completed video', { rawResponse });
 *   // on error:
 *   await logError(logId, error.message);
 */

import { prisma } from '@/lib/prisma';

export async function logStart(campaignId, step, message, input, postId) {
  try {
    const row = await prisma.videoCampaignLog.create({
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
    return null;
  }
}

export async function logDone(logId, message, output) {
  if (!logId) return;
  try {
    await prisma.videoCampaignLog.update({
      where: { id: logId },
      data: { status: 'done', message, output: output ?? null },
    });
  } catch {
    // silent
  }
}

export async function logError(logId, message, output) {
  if (!logId) return;
  try {
    await prisma.videoCampaignLog.update({
      where: { id: logId },
      data: { status: 'error', message, output: output ?? null },
    });
  } catch {
    // silent
  }
}

export async function logInfo(campaignId, step, message, data, postId) {
  try {
    await prisma.videoCampaignLog.create({
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
