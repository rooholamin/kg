/**
 * One-off ops utility — NOT part of the app runtime. Mirrors
 * createReferenceElement() in services/video-ai.service.js exactly, but
 * runs standalone (no Next.js path aliases / Prisma) so it can be used to
 * backfill/reconcile a section's Higgsfield Reference Element directly
 * against production data without needing an authenticated HTTP session.
 *
 * Usage:
 *   node scripts/create-reference-element.mjs "KG Living" \
 *     https://.../livia.jpg https://.../extra1.jpg ...
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const [, , sectionName, ...referenceImageUrls] = process.argv;
if (!sectionName || !referenceImageUrls.length) {
  console.error('Usage: node scripts/create-reference-element.mjs <sectionName> <imageUrl1> [imageUrl2 ...]');
  process.exit(1);
}

const AGENT_ID = process.env.CHARACTER_ADMIN_AGENT_ID || 'agent_01XxEnEphu9yRYoktx6JszNA';
const ENV_ID = process.env.CHARACTER_ADMIN_ENVIRONMENT_ID || 'env_01WNdXu7U4Q1DAirmfvPdmkS';
const VAULT_ID = process.env.HIGGSFIELD_VAULT_ID || 'vlt_011CdTysKds9FQVD41EkLJwe';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

const session = await client.beta.sessions.create({
  agent: AGENT_ID,
  environment_id: ENV_ID,
  vault_ids: [VAULT_ID],
});
console.error('Session:', session.id);

const message = `SECTION: ${sectionName}

REFERENCE IMAGE URLS:
${referenceImageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

Import these images and create a Higgsfield Reference Element for this character, then respond with the final JSON described in your instructions.`;

await client.beta.sessions.events.send(session.id, {
  events: [{ type: 'user.message', content: [{ type: 'text', text: message }] }],
});

const textParts = [];
let done = false;
while (!done) {
  const stream = await client.beta.sessions.events.stream(session.id);
  for await (const event of stream) {
    if (event.type === 'agent.message') {
      for (const block of event.content ?? []) {
        if (block.type === 'text' && block.text) textParts.push(block.text);
      }
    } else if (event.type === 'session.status_idle') {
      if (event.stop_reason?.type === 'end_turn') { done = true; break; }
      if (event.stop_reason?.type === 'requires_action') {
        console.error('UNEXPECTED requires_action:', JSON.stringify(event.stop_reason));
        done = true;
        break;
      }
    } else if (event.type === 'session.status_terminated' || event.type === 'session.deleted') {
      done = true;
      break;
    } else if (event.type === 'session.error') {
      console.error('SESSION ERROR:', JSON.stringify(event));
      done = true;
      break;
    }
  }
}

const responseText = textParts.join('').trim();
console.error('\n--- RAW RESPONSE ---\n' + responseText + '\n--------------------\n');

const match = responseText.match(/\{[\s\S]*\}/);
if (!match) {
  console.error('No JSON found in response.');
  process.exit(1);
}
console.log(match[0]);
