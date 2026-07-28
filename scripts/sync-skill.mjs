/**
 * One-off ops utility — NOT part of the app runtime. Uploads the contents of
 * a local skill directory (must contain SKILL.md at its root) as a new
 * version of an existing Anthropic skill, since agents pin `version: latest`
 * and the API has no in-place file edit — every content change needs a new
 * version.
 *
 * Usage:
 *   node scripts/sync-skill.mjs video-director-skill skill_01MzvGoWuWq59M8Ervu3pu7t
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import Anthropic, { toFile } from '@anthropic-ai/sdk';

const [, , dirArg, skillId] = process.argv;
if (!dirArg || !skillId) {
  console.error('Usage: node scripts/sync-skill.mjs <skill-directory> <skill_id>');
  process.exit(1);
}

const dir = path.resolve(dirArg);
const fileNames = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
if (!fileNames.includes('SKILL.md')) {
  console.error(`No SKILL.md found at the root of ${dir}`);
  process.exit(1);
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

const skillMd = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
const nameMatch = skillMd.match(/^name:\s*(.+)$/m);
if (!nameMatch) {
  console.error('Could not find a `name:` field in SKILL.md frontmatter.');
  process.exit(1);
}
const topLevelFolder = nameMatch[1].trim();
const files = await Promise.all(
  fileNames.map((name) =>
    toFile(fs.createReadStream(path.join(dir, name)), `${topLevelFolder}/${name}`),
  ),
);

const version = await client.beta.skills.versions.create(skillId, { files });
console.log(`Created version ${version.version ?? version.id ?? JSON.stringify(version)} for skill ${skillId}`);
