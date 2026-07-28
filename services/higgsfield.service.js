/**
 * Server-side Higgsfield integration for the Video Campaign pipeline.
 *
 * Uses @higgsfield/client's v2 client (long-lived HIGGSFIELD_KEY_ID/SECRET —
 * no CI-hostile OAuth, no daily token expiry, see higgsfield-ai/cli#47) rather
 * than the hosted Higgsfield MCP server (interactive OAuth only) or the CLI in
 * a Managed Agents cloud sandbox (same OAuth problem). Credentials never leave
 * this server — the Video Director Agent only sees the 3 custom tools below
 * (generateImage/generateVideo/getGenerationStatus), never the API key itself.
 *
 * create_character (Soul Character training) is intentionally NOT one of the
 * per-post director's tools — it's a one-time admin action (see
 * app/api/video/characters/[sectionId]/train) so a per-article session can
 * never trigger an unplanned, credit-burning retrain.
 */
import { createHiggsfieldClient } from '@higgsfield/client/v2';
import { HiggsfieldClient } from '@higgsfield/client';

const BASE_URL = process.env.HIGGSFIELD_BASE_URL || 'https://platform.higgsfield.ai';

// The v2 client only ships typed helpers for a few endpoints (soul stills,
// DoP image-to-video, speak). Higgsfield's model roster (Seedance, Kling,
// etc.) is reached through the same generic subscribe(endpoint, ...) call —
// which endpoint slug is live depends on the account's plan, so it's
// configurable rather than hardcoded.
const IMAGE_ENDPOINT = process.env.HIGGSFIELD_IMAGE_ENDPOINT || '/v1/text2image/soul';
const VIDEO_ENDPOINT = process.env.HIGGSFIELD_VIDEO_ENDPOINT || '/v1/image2video/dop';

function getCredentials() {
  const keyId = process.env.HIGGSFIELD_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('HIGGSFIELD_KEY_ID / HIGGSFIELD_KEY_SECRET are not set');
  }
  return `${keyId}:${keySecret}`;
}

let v2Client = null;
function getV2Client() {
  if (!v2Client) {
    v2Client = createHiggsfieldClient({ credentials: getCredentials(), baseURL: BASE_URL });
  }
  return v2Client;
}

let v1Client = null;
function getV1Client() {
  if (!v1Client) {
    const [apiKey, apiSecret] = getCredentials().split(':');
    v1Client = new HiggsfieldClient({ apiKey, apiSecret, baseURL: BASE_URL });
  }
  return v1Client;
}

// ---------------------------------------------------------------------------
// Application-level guardrail — custom tools bypass Anthropic's built-in
// permission-policy confirmations, so cap how many paid generations a single
// director session can fire in one post (VideoSettings.maxGenerationsPerPost).
// ---------------------------------------------------------------------------
const generationCounts = new Map(); // postId -> count, cleared by the caller per post

export function resetGenerationBudget(postId) {
  generationCounts.delete(postId);
}

function checkAndIncrementBudget(postId, maxGenerationsPerPost) {
  const count = generationCounts.get(postId) || 0;
  if (count >= maxGenerationsPerPost) {
    throw new Error(
      `Generation budget exceeded for this post (max ${maxGenerationsPerPost} calls) — ` +
      `use get_generation_status on an existing job instead of firing a new one.`,
    );
  }
  generationCounts.set(postId, count + 1);
}

// ---------------------------------------------------------------------------
// generateImage — Soul still, optionally anchored to a trained Soul Character
// (Section.videoCharacterId) for on-model consistency. Always 2k-equivalent
// ("1080p") per the "never use 4k, it looks plastic" golden rule.
// ---------------------------------------------------------------------------
export async function generateImage({ postId, prompt, aspectRatio, characterId, maxGenerationsPerPost }) {
  checkAndIncrementBudget(postId, maxGenerationsPerPost ?? 4);

  const input = {
    prompt,
    width_and_height: aspectRatioToSoulSize(aspectRatio),
    quality: '1080p',
    batch_size: 1,
    ...(characterId ? { custom_reference_id: characterId, custom_reference_strength: 1 } : {}),
  };

  const response = await getV2Client().subscribe(IMAGE_ENDPOINT, { input, withPolling: false });
  return normalizeResponse(response);
}

// ---------------------------------------------------------------------------
// generateVideo — image-to-video from a start frame (the still generateImage
// just produced, or a previous shot's last frame for continuation), directed
// by the script the agent wrote. Endpoint/model is configurable (see above).
// ---------------------------------------------------------------------------
export async function generateVideo({ postId, prompt, startImageUrl, aspectRatio, duration, maxGenerationsPerPost }) {
  checkAndIncrementBudget(postId, maxGenerationsPerPost ?? 4);

  if (!startImageUrl) {
    throw new Error('generateVideo requires startImageUrl — generate a still first with generate_image.');
  }

  const input = {
    model: 'dop-standard',
    prompt,
    input_images: [{ type: 'image_url', image_url: startImageUrl }],
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(duration ? { duration } : {}),
  };

  const response = await getV2Client().subscribe(VIDEO_ENDPOINT, { input, withPolling: false });
  return normalizeResponse(response);
}

// ---------------------------------------------------------------------------
// getGenerationStatus — polls a request created by generateImage/generateVideo.
// The v2 client only exposes polling internally (inside subscribe's own
// withPolling loop), so this hits the same GET /requests/{id}/status endpoint
// directly with the same "Key ID:SECRET" auth header.
// ---------------------------------------------------------------------------
export async function getGenerationStatus(requestId) {
  const res = await fetch(`${BASE_URL}/requests/${requestId}/status`, {
    headers: { Authorization: `Key ${getCredentials()}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Higgsfield status check failed (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }
  return normalizeResponse(body);
}

// ---------------------------------------------------------------------------
// createCharacter — ADMIN ONLY (see app/api/video/characters). Trains a Soul
// Character from 3-5 reference images of a section's existing avatar
// (Section.characterImage + any extra shots), returns a durable character ID
// stored on Section.videoCharacterId. Never called by the director agent.
// ---------------------------------------------------------------------------
export async function createCharacter({ name, referenceImageUrls }) {
  if (!referenceImageUrls?.length) {
    throw new Error('createCharacter requires at least one reference image URL');
  }
  const soulId = await getV1Client().createSoulId(
    {
      name,
      input_images: referenceImageUrls.map((url) => ({ type: 'image_url', image_url: url })),
    },
    true, // withPolling — training takes a few minutes, this is an admin action, ok to block
  );
  return { id: soulId.id, name: soulId.name, status: soulId.status };
}

export async function listCharacters(page = 1, pageSize = 50) {
  return getV1Client().listSoulIds(page, pageSize);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function aspectRatioToSoulSize(aspectRatio) {
  const map = {
    '9:16': 'PORTRAIT_1536x2048',
    '16:9': 'LANDSCAPE_2048x1536',
    '1:1': 'SQUARE_1536x1536',
    '4:5': 'PORTRAIT_1536x1920',
  };
  return map[aspectRatio] || map['9:16'];
}

function normalizeResponse(response) {
  if (!response) return response;
  return {
    requestId: response.request_id,
    status: response.status,
    imageUrl: response.images?.[0]?.url ?? null,
    videoUrl: response.video?.url ?? null,
    statusUrl: response.status_url,
  };
}
