/**
 * Server-side Higgsfield integration for the Video Campaign pipeline.
 *
 * Uses @higgsfield/client's v1 client with long-lived HIGGSFIELD_KEY_ID/SECRET
 * (no CI-hostile OAuth, no daily token expiry, see higgsfield-ai/cli#47)
 * rather than the hosted Higgsfield MCP server (interactive OAuth only) or the
 * CLI in a Managed Agents cloud sandbox (same OAuth problem). Credentials
 * never leave this server — the Video Director Agent only sees the 3 custom
 * tools below (generateImage/generateVideo/getGenerationStatus), never the
 * API key itself.
 *
 * v1, not v2: the v2 client's subscribe() sends the request body unwrapped,
 * but /v1/text2image/soul and /v1/image2video/dop both require it wrapped as
 * { params: {...} } — confirmed via direct API testing after a real agent
 * session hit a 422 "body.params: Field required" on every generation call.
 * The v1 client's .generate() wraps correctly.
 *
 * create_character (Soul Character training) is intentionally NOT one of the
 * per-post director's tools — it's a one-time admin action (see
 * app/api/video/characters/[sectionId]/train) so a per-article session can
 * never trigger an unplanned, credit-burning retrain.
 */
import { HiggsfieldClient } from '@higgsfield/client';

const BASE_URL = process.env.HIGGSFIELD_BASE_URL || 'https://platform.higgsfield.ai';

// These are v1-style endpoints: they require the request body wrapped as
// { params: {...} } (v1 client's .generate() does this), NOT the v2 client's
// subscribe(), which sends the input unwrapped and gets a 422
// "body.params: Field required" back — a real bug found in production (an
// agent session hit exactly this, exhausted its generation budget on
// structurally-invalid calls, and correctly reported failure). Higgsfield's
// model roster (Seedance, Kling, etc.) may live at different slugs depending
// on the account's plan, so the endpoint itself stays configurable.
const IMAGE_ENDPOINT = process.env.HIGGSFIELD_IMAGE_ENDPOINT || '/v1/text2image/soul';
const VIDEO_ENDPOINT = process.env.HIGGSFIELD_VIDEO_ENDPOINT || '/v1/image2video/dop';
const VIDEO_MODEL = process.env.HIGGSFIELD_VIDEO_MODEL || 'dop-turbo'; // valid: dop-lite | dop-preview | dop-turbo

function getCredentials() {
  const keyId = process.env.HIGGSFIELD_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('HIGGSFIELD_KEY_ID / HIGGSFIELD_KEY_SECRET are not set');
  }
  return `${keyId}:${keySecret}`;
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
//
// Uses the v1 client's .generate() (wraps the body as { params: {...} }, per
// what these v1-style endpoints actually require) rather than v2's
// .subscribe() (sends the body unwrapped — confirmed via direct API test to
// produce a 422 "body.params: Field required" with no requestId, exactly the
// failure an agent session hit in production).
// ---------------------------------------------------------------------------
export async function generateImage({ postId, prompt, aspectRatio, characterId, maxGenerationsPerPost }) {
  checkAndIncrementBudget(postId, maxGenerationsPerPost ?? 4);

  const params = {
    prompt,
    width_and_height: aspectRatioToSoulSize(aspectRatio),
    quality: '1080p',
    batch_size: 1,
    ...(characterId ? { custom_reference_id: characterId, custom_reference_strength: 1 } : {}),
  };

  const jobSet = await getV1Client().generate(IMAGE_ENDPOINT, params, { withPolling: false });
  return normalizeJobSet(jobSet);
}

// ---------------------------------------------------------------------------
// generateVideo — image-to-video from a start frame (the still generateImage
// just produced, or a previous shot's last frame for continuation), directed
// by the script the agent wrote. Endpoint/model is configurable (see above);
// `model` must be one of dop-lite/dop-preview/dop-turbo (confirmed via API —
// the previously-hardcoded 'dop-standard' doesn't exist and was rejected).
// ---------------------------------------------------------------------------
export async function generateVideo({ postId, prompt, startImageUrl, maxGenerationsPerPost }) {
  checkAndIncrementBudget(postId, maxGenerationsPerPost ?? 4);

  if (!startImageUrl) {
    throw new Error('generateVideo requires startImageUrl — generate a still first with generate_image.');
  }

  const params = {
    model: VIDEO_MODEL,
    prompt,
    input_images: [{ type: 'image_url', image_url: startImageUrl }],
  };

  const jobSet = await getV1Client().generate(VIDEO_ENDPOINT, params, { withPolling: false });
  return normalizeJobSet(jobSet);
}

// ---------------------------------------------------------------------------
// getGenerationStatus — polls a job set created by generateImage/generateVideo
// via GET /v1/job-sets/{id} (confirmed against the live API — this is the
// actual v1 polling endpoint; the v2-style /requests/{id}/status used here
// previously does not apply to jobs created through the v1 .generate() call).
// ---------------------------------------------------------------------------
export async function getGenerationStatus(jobSetId) {
  const res = await fetch(`${BASE_URL}/v1/job-sets/${jobSetId}`, {
    headers: { Authorization: `Key ${getCredentials()}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Higgsfield status check failed (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }
  return normalizeJobSet(body);
}

// ---------------------------------------------------------------------------
// createCharacter — ADMIN ONLY (see app/api/video/characters). Kicks off Soul
// Character training from 3-5 reference images of a section's existing
// avatar (Section.characterImage + any extra shots) and returns immediately
// — training itself takes minutes on Higgsfield's side. Deliberately
// non-blocking (withPolling: false): blocking an HTTP request for that long
// is fragile (a PM2 restart, proxy timeout, or dropped connection during the
// wait leaves the request hung with no way to ever resolve, even though
// training keeps running server-side on Higgsfield regardless). The returned
// ID is stable and durable — save it immediately and check status separately
// via getCharacterStatus. Never called by the director agent.
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
    false, // withPolling: false — return immediately, poll separately via getCharacterStatus
  );
  return { id: soulId.id, name: soulId.name, status: soulId.status };
}

// Polls a single Soul Character's current training status without blocking —
// same underlying endpoint the SDK's own (unused-here) polling loop hits.
export async function getCharacterStatus(characterId) {
  const res = await fetch(`${BASE_URL}/v1/custom-references/${characterId}`, {
    headers: { Authorization: `Key ${getCredentials()}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Higgsfield character status check failed (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }
  return { id: body?.id, name: body?.name, status: body?.status, thumbnailUrl: body?.thumbnail_url ?? null };
}

export async function listCharacters(page = 1, pageSize = 50) {
  return getV1Client().listSoulIds(page, pageSize);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// width_and_height must be one of the API's actual dimension strings (verified
// via live 422 response) — not the enum-style names the SDK examples imply.
// Values chosen for exact or closest ratio match.
function aspectRatioToSoulSize(aspectRatio) {
  const map = {
    '9:16': '1152x2048', // exact
    '16:9': '2048x1152', // exact
    '1:1': '1536x1536', // exact
    '4:5': '1152x1536', // closest available (0.75 vs 0.8)
    '3:4': '1152x1536', // exact
    '21:9': '2048x1152', // no ultra-wide option; falls back to widest available
  };
  return map[aspectRatio] || map['9:16'];
}

// Job-set response shape (confirmed via live API):
// { id, jobs: [{ id, status, results: { raw: {url,type}, min: {url,type} } | null }] }
// Both imageUrl/videoUrl are set to the same resolved URL when present —
// getGenerationStatus is shared by both generateImage and generateVideo jobs,
// so the caller (the director agent) just reads whichever field name it
// expects for the request it made; harmless duplication otherwise.
function normalizeJobSet(jobSet) {
  if (!jobSet) return jobSet;
  const job = jobSet.jobs?.[0];
  const url = job?.results?.raw?.url ?? null;
  return {
    requestId: jobSet.id,
    status: job?.status ?? 'queued',
    imageUrl: url,
    videoUrl: url,
  };
}
