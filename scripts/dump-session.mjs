/**
 * One-off debug utility — NOT part of the app runtime. Fetches a Managed
 * Agent session's metadata + full event history and saves them to disk for
 * offline inspection.
 *
 * Usage:
 *   node scripts/dump-session.mjs sesn_01EFB1y8CQgXxHUTAfjXJnua
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const [, , sessionId] = process.argv;
if (!sessionId) {
  console.error('Usage: node scripts/dump-session.mjs <sesn_...>');
  process.exit(1);
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

const outDir = path.join('/tmp', `session-dump-${sessionId}`);
fs.mkdirSync(outDir, { recursive: true });

const session = await client.beta.sessions.retrieve(sessionId);
fs.writeFileSync(path.join(outDir, 'session.json'), JSON.stringify(session, null, 2));
console.log(`Session status: ${session.status} | agent: ${session.agent?.name} | created: ${session.created_at}`);

const events = [];
for await (const event of client.beta.sessions.events.list(sessionId, { order: 'asc' })) {
  events.push(event);
}
fs.writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(events, null, 2));
console.log(`Fetched ${events.length} events`);

// Human-readable narrative — one line/block per event, easier to scan than raw JSON
const lines = [];
for (const ev of events) {
  const ts = ev.processed_at || ev.created_at || '';
  lines.push(`\n=== [${ts}] ${ev.type} (id=${ev.id}) ===`);
  if (ev.type === 'user.message' || ev.type === 'agent.message') {
    for (const block of ev.content ?? []) {
      if (block.type === 'text') lines.push(block.text);
      else lines.push(`[${block.type} block]`);
    }
  } else if (ev.type === 'agent.tool_use' || ev.type === 'agent.mcp_tool_use' || ev.type === 'agent.custom_tool_use') {
    lines.push(`tool: ${ev.name}`);
    lines.push(`input: ${JSON.stringify(ev.input, null, 2)}`);
  } else if (ev.type === 'agent.tool_result' || ev.type === 'agent.mcp_tool_result' || ev.type === 'user.tool_result' || ev.type === 'user.custom_tool_result') {
    lines.push(`is_error: ${ev.is_error ?? false}`);
    for (const block of ev.content ?? []) {
      if (block.type === 'text') lines.push(block.text);
      else lines.push(`[${block.type} block]`);
    }
  } else if (ev.type === 'agent.thinking') {
    lines.push(ev.thinking || '');
  } else if (ev.type === 'session.error') {
    lines.push(JSON.stringify(ev, null, 2));
  } else if (ev.type === 'session.status_idle') {
    lines.push(`stop_reason: ${JSON.stringify(ev.stop_reason)}`);
  } else {
    lines.push(JSON.stringify(ev, null, 2));
  }
}
fs.writeFileSync(path.join(outDir, 'transcript.txt'), lines.join('\n'));

console.log(`\nSaved to ${outDir}:`);
console.log(`  session.json    - session metadata/stats`);
console.log(`  events.json     - raw event array`);
console.log(`  transcript.txt  - human-readable narrative`);
