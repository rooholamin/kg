/**
 * One-off debug utility — NOT part of the app runtime. Opens a throwaway
 * session with the video director agent and asks it to run models_explore
 * on the given model IDs, printing the raw schema JSON for each.
 *
 * Usage:
 *   node scripts/query-model-schema.mjs soul_2 nano_banana_2 text2image_soul_v2
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const modelIds = process.argv.slice(2);
if (!modelIds.length) {
  console.error('Usage: node scripts/query-model-schema.mjs <model_id> [model_id...]');
  process.exit(1);
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

// Pulled directly from a recent real session dump (VideoSettings unreachable
// from this sandbox — local dev DB is down); same director agent/env/vault
// the app itself uses in production.
const DIRECTOR_AGENT_ID = 'agent_01LYvnZ9X5G7TUgHNV2Qi5YF';
const DIRECTOR_ENVIRONMENT_ID = 'env_01M6YyChcqMxGYZ32hf38x8q';
const HIGGSFIELD_VAULT_ID = 'vlt_011CdTysKds9FQVD41EkLJwe';

async function main() {
  const session = await client.beta.sessions.create({
    agent: DIRECTOR_AGENT_ID,
    environment_id: DIRECTOR_ENVIRONMENT_ID,
    vault_ids: [HIGGSFIELD_VAULT_ID],
  });
  console.log('Session:', session.id);

  const message = `PHASE: execute\n\nBefore directing this segment, per your own instructions ("Always check this before your first call to a model in a session"), please call models_explore with action "get" for each of these model_ids: ${modelIds.join(', ')}. Then, instead of proceeding to generate anything, just report back the exact raw schema JSON you got back for each one so I can review the parameter options before we continue — respond with ONLY a JSON object mapping each model_id to its schema, no generation calls yet.`;

  await client.beta.sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: message }] }],
  });

  const textParts = [];
  let done = false;
  while (!done) {
    const stream = await client.beta.sessions.events.stream(session.id);
    for await (const event of stream) {
      if (event.type === 'agent.mcp_tool_use') {
        console.log('\n>>> tool_use:', event.name, JSON.stringify(event.input));
      } else if (event.type === 'agent.mcp_tool_result') {
        const text = (event.content || []).map((c) => c.text).join('');
        console.log('<<< tool_result:', text.slice(0, 3000));
      } else if (event.type === 'agent.message') {
        for (const block of event.content ?? []) {
          if (block.type === 'text') textParts.push(block.text);
        }
      } else if (event.type === 'session.status_idle') {
        if (event.stop_reason?.type === 'end_turn') { done = true; break; }
      } else if (event.type === 'session.status_terminated' || event.type === 'session.deleted') {
        done = true; break;
      }
    }
  }

  console.log('\n===== FINAL RESPONSE =====');
  console.log(textParts.join(''));
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
