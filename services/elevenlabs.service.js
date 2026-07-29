/**
 * ElevenLabs Music API integration — background music only. Narration itself
 * is handled entirely by Higgsfield Seedance 2.0's native audio (both on-camera
 * dialogue and off-screen voiceover), confirmed working in testing, so there is
 * no TTS/voice-cloning function here — just a duration-matched instrumental bed
 * mixed in later by video-assembly.service.js.
 *
 * Confirmed via direct testing: POST /v1/music accepts `prompt`,
 * `music_length_ms` (3,000-600,000ms), `model_id` ("music_v2"), and
 * `force_instrumental` (keeps vocals out of the way of the narration).
 * The response body IS the raw audio file (mp3), not JSON.
 */

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const MIN_DURATION_MS = 3000;
const MAX_DURATION_MS = 600000;

export async function composeMusic({ prompt, durationMs, modelId }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');
  if (!prompt) throw new Error('composeMusic requires a prompt');
  if (!durationMs) throw new Error('composeMusic requires durationMs');

  const clampedDurationMs = Math.min(Math.max(Math.round(durationMs), MIN_DURATION_MS), MAX_DURATION_MS);

  const res = await fetch(`${ELEVENLABS_API_BASE}/music`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: clampedDurationMs,
      model_id: modelId || 'music_v2',
      force_instrumental: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs Music API failed (HTTP ${res.status}): ${body.slice(0, 500)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: 'audio/mpeg', durationMs: clampedDurationMs };
}

// $0.15/minute (official published API rate — elevenlabs.io/pricing/api,
// confirmed current as of this writing) — exactly calculable from the
// generated track's real duration, not an estimate, unlike Higgsfield's
// segment costs (see lib/video-cost.js).
const MUSIC_PRICE_PER_MINUTE_USD = 0.15;

export function calculateMusicCost(durationMs) {
  const minutes = durationMs / 60000;
  return Math.round(minutes * MUSIC_PRICE_PER_MINUTE_USD * 100) / 100;
}
