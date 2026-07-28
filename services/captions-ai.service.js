/**
 * Captions.ai (Mirage API) integration — adds professional, animated,
 * word-by-word captions to a finished, assembled video. Confirmed working
 * end-to-end in testing on three real assembled videos.
 *
 * Hard constraints (API-enforced, not just recommended):
 *   - Input video MUST be 9:16 aspect ratio
 *   - Input video MUST be <= 50MB
 * There is NO API-level control over font size/margins/safe-zones — that only
 * exists in Captions.ai's own app. Template choice is the only lever we have;
 * "Aries" (condensed) tested well within frame margins ("Magazine" overflowed).
 *
 * Flow: POST /v1/videos/captions (multipart: video + caption_template_id)
 * -> poll GET /v1/videos/{id} until status is COMPLETE/FAILED/CANCELLED
 * -> GET /v1/videos/{id}/content (redirects to the final mp4) to download.
 */

const CAPTIONS_AI_API_BASE = 'https://api.mirage.app/v1';
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

function getApiKey() {
  const apiKey = process.env.CAPTIONS_AI_API_KEY;
  if (!apiKey) throw new Error('CAPTIONS_AI_API_KEY is not configured');
  return apiKey;
}

export async function listCaptionTemplates({ limit = 50 } = {}) {
  const res = await fetch(`${CAPTIONS_AI_API_BASE}/videos/captions/templates?limit=${limit}`, {
    headers: { 'x-api-key': getApiKey() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Captions.ai list templates failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * @param {Object} params
 * @param {Buffer} params.videoBuffer - the assembled (concat+music) 9:16 mp4
 * @param {string} params.templateId - Captions.ai caption_template_id (e.g. "Aries")
 * @returns {Promise<{ buffer: Buffer, videoId: string }>}
 */
export async function addCaptions({ videoBuffer, templateId }) {
  if (!videoBuffer?.length) throw new Error('addCaptions requires a non-empty videoBuffer');
  if (!templateId) throw new Error('addCaptions requires a templateId');
  if (videoBuffer.length > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video is ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB — Captions.ai requires <= 50MB. Compress before submitting.`,
    );
  }

  const apiKey = getApiKey();

  const form = new FormData();
  form.append('caption_template_id', templateId);
  form.append('video', new Blob([videoBuffer], { type: 'video/mp4' }), 'video.mp4');

  const submitRes = await fetch(`${CAPTIONS_AI_API_BASE}/videos/captions`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
  });

  if (!submitRes.ok) {
    const body = await submitRes.text().catch(() => '');
    throw new Error(`Captions.ai submit failed (HTTP ${submitRes.status}): ${body.slice(0, 500)}`);
  }

  const job = await submitRes.json();
  const videoId = job.id || job.video_id;
  if (!videoId) throw new Error(`Captions.ai returned no video id: ${JSON.stringify(job).slice(0, 300)}`);

  const finalStatus = await pollUntilDone(videoId, apiKey);
  if (finalStatus.status !== 'COMPLETE') {
    throw new Error(
      `Captions.ai job ${videoId} ended as ${finalStatus.status}: ${finalStatus.error?.message || 'unknown error'}`,
    );
  }

  const contentRes = await fetch(`${CAPTIONS_AI_API_BASE}/videos/${videoId}/content`, {
    headers: { 'x-api-key': apiKey },
    redirect: 'follow',
  });
  if (!contentRes.ok) {
    throw new Error(`Captions.ai content download failed (HTTP ${contentRes.status}) for video ${videoId}`);
  }

  const buffer = Buffer.from(await contentRes.arrayBuffer());
  return { buffer, videoId };
}

async function pollUntilDone(videoId, apiKey) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${CAPTIONS_AI_API_BASE}/videos/${videoId}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'COMPLETE' || data.status === 'FAILED' || data.status === 'CANCELLED') {
        return data;
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Captions.ai job ${videoId} timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// $0.15/minute, rounded UP to the nearest minute — exact from published pricing, not an estimate.
export function calculateCaptionsCost(durationMs) {
  const minutes = Math.ceil(durationMs / 60000);
  return Math.round(minutes * 0.15 * 100) / 100;
}
