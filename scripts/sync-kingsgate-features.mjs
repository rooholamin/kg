/**
 * One-off/occasionally-rerun ops utility — NOT part of the app runtime.
 * Fetches the full `features` taxonomy term list (name + id) from
 * kingsgateluxuryhomes.com and writes it to data/kingsgate-features.json.
 *
 * Deliberately a static file, not a live "list features" tool call: the
 * kingsgate-linking-agent reads this list from the task message
 * services/kingsgate-linking.service.js sends it each batch (not baked into
 * the agent's YAML), so re-running this script is enough to pick up new
 * feature terms — no agent re-sync needed.
 *
 * Usage:
 *   node scripts/sync-kingsgate-features.mjs
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const siteUrl = (process.env.KINGSGATE_WP_SITE_URL || 'https://kingsgateluxuryhomes.com').replace(/\/+$/, '');

async function fetchAllTerms() {
  const perPage = 100;
  let page = 1;
  const all = [];

  while (true) {
    const url = `${siteUrl}/wp-json/wp/v2/features?per_page=${perPage}&page=${page}&orderby=count&order=desc&_fields=id,name,slug,count`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`Fetch failed on page ${page}: HTTP ${res.status}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return all;
}

const terms = await fetchAllTerms();
const used = terms.filter((t) => t.count > 0);

const outPath = path.join(__dirname, '..', 'data', 'kingsgate-features.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      source: `${siteUrl}/wp-json/wp/v2/features`,
      fetchedAt: new Date().toISOString(),
      totalTerms: terms.length,
      usedTerms: used.length,
      // Only terms actually assigned to at least one post are worth giving
      // the agent — the rest are noise it would never find a match for anyway.
      features: used.map((t) => ({ id: t.id, name: t.name, count: t.count })),
    },
    null,
    2,
  ),
);

console.log(
  `Wrote ${used.length} used feature term(s) (of ${terms.length} total) to ${path.relative(process.cwd(), outPath)}`,
);
