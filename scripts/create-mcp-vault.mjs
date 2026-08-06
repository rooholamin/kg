/**
 * One-off ops utility — NOT part of the app runtime. Creates an Anthropic
 * vault holding a static_bearer credential for our own internal SEO MCP
 * server (app/api/mcp/seo), so the seo-agent / kingsgate-linking-agent
 * sessions can authenticate to it via `vault_ids` (see docs/managed-agents/vaults).
 * Same shape as VideoSettings.higgsfieldVaultId, just backed by a shared
 * secret instead of OAuth.
 *
 * Prints the resulting vault id — paste it into SeoSettings.mcpVaultId
 * (SEO → Settings) once printed.
 *
 * Requires MCP_SEO_SECRET (the same value app/api/mcp/seo checks) and
 * MCP_SEO_URL (defaults to https://api.kghub.ai/api/mcp/seo, matching the
 * mcp_servers.url in seo-agent.yaml / kingsgate-linking-agent.yaml) to
 * already be set.
 *
 * Usage:
 *   node scripts/create-mcp-vault.mjs
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const secret = process.env.MCP_SEO_SECRET;
const mcpServerUrl = process.env.MCP_SEO_URL || 'https://api.kghub.ai/api/mcp/seo';

if (!secret) {
  console.error('MCP_SEO_SECRET is not set — nothing to register.');
  process.exit(1);
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

const vault = await client.beta.vaults.create({
  display_name: 'KGHub SEO MCP server',
  metadata: { purpose: 'seo-agent + kingsgate-linking-agent shared MCP auth' },
});

await client.beta.vaults.credentials.create(vault.id, {
  display_name: 'KGHub SEO MCP static bearer',
  auth: {
    type: 'static_bearer',
    mcp_server_url: mcpServerUrl,
    token: secret,
  },
});

console.log(`Created vault: ${vault.id}`);
console.log(`Registered static_bearer credential for ${mcpServerUrl}`);
console.log('\nNext step: set this as SeoSettings.mcpVaultId (SEO → Settings) for both agents.');
