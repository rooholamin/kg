/**
 * One-off ops utility — NOT part of the app runtime. Creates the Scheduled
 * Deployment that drives news-writer-agent.yaml — a real cron, running
 * entirely on Anthropic's own infrastructure, independent of KGHub's app
 * being up. Re-running this creates a NEW deployment each time; if one
 * already exists, archive/pause it first via the Console or the API rather
 * than accumulating duplicates that would both fire.
 *
 * Usage:
 *   node scripts/create-news-writer-deployment.mjs
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const AGENT_ID = process.env.NEWS_WRITER_AGENT_ID || 'agent_01J8NeMeiQdaAQaWWENSd4Bp';
const ENVIRONMENT_ID = process.env.NEWS_WRITER_ENVIRONMENT_ID || 'env_016vk3LK2xxRWgxVSovFLhYP';
// Same vault seo-agent/kingsgate-linking-agent already use for the same
// kghub_seo MCP server (see scripts/create-mcp-vault.mjs) — without this,
// the deployment's sessions have no credential for the server URL at all.
const MCP_VAULT_ID = process.env.MCP_SEO_VAULT_ID || 'vlt_011CdkyrBCeTyKNNwUqrF92e';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

const deployment = await client.beta.deployments.create({
  name: 'KG Hub News Writer — hourly',
  agent: AGENT_ID,
  environment_id: ENVIRONMENT_ID,
  vault_ids: [MCP_VAULT_ID],
  initial_events: [
    {
      type: 'user.message',
      content: [{ type: 'text', text: 'Check for a new private post and process it now.' }],
    },
  ],
  schedule: {
    type: 'cron',
    // Top of every hour, UTC — avoids the DST double/skip-fire edge cases
    // near 1-3AM local time that a named timezone would hit twice a year.
    expression: '0 * * * *',
    timezone: 'UTC',
  },
});

console.log(`Created deployment: ${deployment.id} (status: ${deployment.status})`);
console.log('Upcoming runs:', deployment.schedule?.upcoming_runs_at);
console.log('\nNext step: node scripts/create-news-writer-deployment.mjs already scheduled it.');
console.log(`To trigger a manual test run now: POST /v1/deployments/${deployment.id}/run`);
