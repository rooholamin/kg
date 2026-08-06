/**
 * One-off ops utility — NOT part of the app runtime. Uploads (or re-uploads
 * a new version of) the kghub-seo-onpage custom Skill from
 * skills-src/kghub-seo-onpage/ to Anthropic's Skills API, mirroring
 * scripts/sync-agent.mjs's "config lives in a reviewable local file, this
 * script is how it gets applied" philosophy.
 *
 * The Skills API has no "update in place" — re-running this creates a NEW
 * skill (or, once supported broadly, a new version of an existing one via
 * client.beta.skills.versions.create). Print the returned skill_id and paste
 * it into seo-agent.yaml's `skills:` field, then re-run
 * `node scripts/sync-agent.mjs seo-agent.yaml --agent-id <id>`.
 *
 * Usage:
 *   node scripts/sync-kghub-seo-skill.mjs
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic, { toFile } from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..', 'skills-src', 'kghub-seo-onpage');
const SKILL_NAME = 'kghub-seo-onpage';

function collectFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, baseDir));
    } else {
      files.push(full);
    }
  }
  return files;
}

const localFiles = collectFiles(SKILL_DIR);
if (!localFiles.some((f) => path.basename(f) === 'SKILL.md' && path.dirname(f) === SKILL_DIR)) {
  console.error(`No SKILL.md found at the root of ${SKILL_DIR}`);
  process.exit(1);
}

// Skills-specific client — no managed-agents default header needed here.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const uploadFiles = await Promise.all(
  localFiles.map(async (fullPath) => {
    const relativePath = path.relative(path.dirname(SKILL_DIR), fullPath); // e.g. "kghub-seo-onpage/SKILL.md"
    const buffer = fs.readFileSync(fullPath);
    return toFile(buffer, relativePath.split(path.sep).join('/'));
  }),
);

console.log(`Uploading ${uploadFiles.length} file(s) for skill "${SKILL_NAME}":`);
for (const f of uploadFiles) console.log(`  - ${f.name}`);

const skill = await client.beta.skills.create({
  display_title: 'KGHub On-Page SEO',
  files: uploadFiles,
  betas: ['skills-2025-10-02'],
});

console.log(`\nCreated skill: ${skill.id} (latest_version: ${skill.latest_version})`);
console.log('\nNext step: set this as the skill_id in seo-agent.yaml\'s `skills:` field, then run:');
console.log(`  node scripts/sync-agent.mjs seo-agent.yaml --agent-id agent_01KLg927ArH5wRzYGkNoJYLF`);
