/**
 * One-off ops utility — NOT part of the app runtime. Pushes a local
 * *-agent.yaml file to Anthropic's Managed Agents API: creates the agent if
 * `--agent-id` isn't given, otherwise updates it in place. Agent config
 * lives in these YAML files rather than the Anthropic Console so it can be
 * code-reviewed and diffed like everything else; this script is how that
 * YAML actually gets applied.
 *
 * Usage:
 *   node scripts/sync-agent.mjs video-director-agent.yaml
 *   node scripts/sync-agent.mjs video-director-agent.yaml --agent-id agent_01LYvnZ9X5G7TUgHNV2Qi5YF
 */
import 'dotenv/config';
import fs from 'node:fs';
import { load } from 'js-yaml';
import Anthropic from '@anthropic-ai/sdk';

const [, , yamlPath, ...rest] = process.argv;
if (!yamlPath) {
  console.error('Usage: node scripts/sync-agent.mjs <path-to-agent.yaml> [--agent-id agent_...]');
  process.exit(1);
}

const agentIdFlagIndex = rest.indexOf('--agent-id');
const agentId = agentIdFlagIndex >= 0 ? rest[agentIdFlagIndex + 1] : null;

const doc = load(fs.readFileSync(yamlPath, 'utf8'));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

const payload = {
  name: doc.name,
  description: doc.description,
  model: doc.model,
  system: doc.system,
  mcp_servers: doc.mcp_servers ?? [],
  tools: doc.tools ?? [],
  skills: doc.skills ?? [],
  metadata: doc.metadata ?? {},
};

const agent = agentId
  ? await client.beta.agents.update(agentId, payload)
  : await client.beta.agents.create(payload);

console.log(`${agentId ? 'Updated' : 'Created'} agent: ${agent.id} (${agent.name})`);
