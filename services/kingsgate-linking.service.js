/**
 * "kingsgate-linking" pipeline engine worker — batch-of-N comparative
 * selection. Reviews a full batch of already-SEO'd articles together and
 * picks AT MOST ONE to receive a natural backlink to a matching
 * kingsgateluxuryhomes.com post. See the plan's "How the linking agent's
 * batch decision works" — this is a comparative pick ("which one of these
 * N, if any"), not an independent per-article yes/no, which is what
 * structurally caps the link rate at <=1-in-batchSize instead of relying on
 * a per-article threshold to hold up over hundreds of runs.
 *
 * The agent inserts the link itself (via the same update_article MCP tool
 * the seo-agent uses) during its own turn; this service's job is to read the
 * agent's final structured decision, apply the bookkeeping (linkReviewed on
 * every article in the batch, kingsgateLinkUrl on the winner only), and log
 * the whole batch's outcome for audit.
 */
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { contentToHtml } from '@/services/wordpress.service';
import { contentLog } from '@/services/content-log.service';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

let cachedFeatureList = null;
function loadKingsgateFeatures() {
  if (cachedFeatureList) return cachedFeatureList;
  try {
    const filePath = path.join(process.cwd(), 'data', 'kingsgate-features.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    cachedFeatureList = Array.isArray(parsed?.features) ? parsed.features : [];
  } catch {
    cachedFeatureList = [];
  }
  return cachedFeatureList;
}

async function getSeoSettings() {
  return prisma.seoSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  });
}

/**
 * Run the linking agent on one full batch of article ids. Returns { ok, error? }
 * — same contract the pipeline engine's other step-runners use.
 */
export async function runKingsgateLinkingBatch(articleIds, userId) {
  const articles = await prisma.article.findMany({
    where: { id: { in: articleIds } },
    include: { topic: true, category: true },
  });
  if (articles.length !== articleIds.length) {
    return { ok: false, error: `Expected ${articleIds.length} articles, found ${articles.length}` };
  }

  const settings = await getSeoSettings();
  if (!settings.linkingAgentId || !settings.linkingEnvironmentId) {
    return { ok: false, error: 'Kingsgate Linking Agent not configured. Set linkingAgentId and linkingEnvironmentId in SEO → Settings.' };
  }

  const runRow = await prisma.kingsgateLinkingBatchRun.create({
    data: { articleIds, status: 'running' },
  });

  const features = loadKingsgateFeatures();
  const featureList = features.length
    ? features.map((f) => `- id ${f.id}: ${f.name}`).join('\n')
    : '(no feature reference list available — run scripts/sync-kingsgate-features.mjs)';

  const articlesBlock = articles
    .map((a, i) => {
      const html = contentToHtml(a.content);
      return `── ARTICLE ${i + 1} ──
ARTICLE ID: ${a.id}
TITLE: ${a.title}
CATEGORY: ${a.category?.name || ''}
TOPIC: ${a.topic?.name || ''}
BODY (HTML):
${html || '(empty)'}`;
    })
    .join('\n\n');

  const message = `BATCH OF ${articles.length} ARTICLES TO REVIEW FOR A POSSIBLE KINGSGATE LINK:

${articlesBlock}

KNOWN KINGSGATE FEATURE TAXONOMY TERMS (use these EXACT ids with get_kingsgate_posts_for_feature — never guess an id):
${featureList}

Review all ${articles.length} articles together and decide whether AT MOST ONE of them should receive a natural backlink to a matching kingsgateluxuryhomes.com post. If you insert a link, use the update_article tool on that one winning article only (contentHtml must be its FULL revised body, not a fragment). Then reply with ONLY valid JSON, no other text:
{
  "selectedArticleId": "<the winning article's ARTICLE ID, or null if no article in this batch qualifies>",
  "matchedFeatureId": <the feature id you matched on, or null>,
  "matchedFeatureName": "<the feature name, or null>",
  "linkedPostUrl": "<the exact URL returned by get_kingsgate_posts_for_feature that you linked to, or null>",
  "reasoning": "<always required — why this article won and the others didn't, or why none of the ${articles.length} qualified this round>"
}`;

  try {
    const session = await client.beta.sessions.create({
      agent: settings.linkingAgentId,
      environment_id: settings.linkingEnvironmentId,
      ...(settings.mcpVaultId ? { vault_ids: [settings.mcpVaultId] } : {}),
    });

    const responseText = await sendAndAwaitResponse(session.id, message);
    const decision = parseDecision(responseText, articleIds);

    const now = new Date();
    await prisma.$transaction([
      prisma.article.updateMany({
        where: { id: { in: articleIds } },
        data: { linkReviewed: true, linkReviewedAt: now },
      }),
      ...(decision.selectedArticleId
        ? [
            prisma.article.update({
              where: { id: decision.selectedArticleId },
              data: { kingsgateLinkUrl: decision.linkedPostUrl ?? null },
            }),
          ]
        : []),
      prisma.kingsgateLinkingBatchRun.update({
        where: { id: runRow.id },
        data: {
          status: 'completed',
          selectedArticleId: decision.selectedArticleId,
          matchedFeature: decision.matchedFeatureName,
          linkedPostUrl: decision.linkedPostUrl,
          reasoning: decision.reasoning,
          agentSessionId: session.id,
        },
      }),
    ]);

    await contentLog({
      type: 'article',
      action: 'automation',
      message: decision.selectedArticleId
        ? `Kingsgate linking batch: linked "${articles.find((a) => a.id === decision.selectedArticleId)?.title ?? decision.selectedArticleId}" to ${decision.linkedPostUrl}`
        : `Kingsgate linking batch: no article in this batch of ${articles.length} qualified for a link`,
      metadata: { batchRunId: runRow.id, articleIds },
      createdBy: userId ?? null,
    });

    return { ok: true, decision };
  } catch (err) {
    const errorMessage = err?.message ?? 'Kingsgate linking agent session failed';
    await prisma.kingsgateLinkingBatchRun.update({
      where: { id: runRow.id },
      data: { status: 'failed', errorMessage },
    }).catch(() => {});
    return { ok: false, error: errorMessage };
  }
}

/**
 * Parse + validate the agent's decision JSON. Defensive: an agent claiming a
 * winner outside this batch, or a malformed reply, degrades to "no link"
 * rather than corrupting an unrelated article.
 */
function parseDecision(responseText, articleIds) {
  let parsed = {};
  try {
    parsed = JSON.parse(extractJson(responseText));
  } catch {
    return { selectedArticleId: null, matchedFeatureName: null, linkedPostUrl: null, reasoning: `Agent returned unparseable JSON: ${responseText.slice(0, 300)}` };
  }

  const selectedArticleId =
    typeof parsed.selectedArticleId === 'string' && articleIds.includes(parsed.selectedArticleId)
      ? parsed.selectedArticleId
      : null;

  return {
    selectedArticleId,
    matchedFeatureName: selectedArticleId ? (parsed.matchedFeatureName ?? null) : null,
    linkedPostUrl: selectedArticleId ? (parsed.linkedPostUrl ?? null) : null,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 4000) : null,
  };
}

function extractJson(text) {
  if (!text) return text;
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
  for (const block of fenced.reverse()) {
    try {
      JSON.parse(block);
      return block;
    } catch { /* not this one */ }
  }
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

// ---------------------------------------------------------------------------
// Session send/stream helpers — same event contract as seo-ai.service.js.
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendAndAwaitResponse(sessionId, message, { maxAttempts = 2 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await client.beta.sessions.events.send(sessionId, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: message }] }],
    });
    try {
      return await streamAgentResponse(sessionId);
    } catch (err) {
      if (err.retriesExhausted && attempt < maxAttempts) {
        await sleep(10000 * attempt);
        continue;
      }
      throw err;
    }
  }
}

async function streamAgentResponse(sessionId) {
  let textParts = [];
  let done = false;

  while (!done) {
    const stream = await client.beta.sessions.events.stream(sessionId);

    for await (const event of stream) {
      const evType = event.type;

      if (evType === 'agent.message') {
        for (const block of event.content ?? []) {
          if (block.type === 'text' && block.text) textParts.push(block.text);
        }
      } else if (evType === 'user.message') {
        textParts = [];
      } else if (evType === 'session.status_idle') {
        if (event.stop_reason?.type === 'end_turn') {
          done = true;
          break;
        }
        if (event.stop_reason?.type === 'requires_action') {
          throw new Error(`Session ${sessionId} unexpectedly requires manual action: ${JSON.stringify(event.stop_reason)}`);
        }
        if (event.stop_reason?.type === 'retries_exhausted') {
          const err = new Error(`Session ${sessionId} exhausted retries — the turn was dropped and needs to be resent.`);
          err.retriesExhausted = true;
          throw err;
        }
      } else if (evType === 'session.status_terminated' || evType === 'session.deleted') {
        done = true;
        break;
      } else if (evType === 'session.error') {
        if (event.error?.retry_status?.type === 'retrying') continue;
        if (event.error?.retry_status?.type === 'exhausted') {
          const err = new Error(`Session ${sessionId} exhausted retries on a model error — the turn was dropped.`);
          err.retriesExhausted = true;
          throw err;
        }
        throw new Error(`Agent session error: ${JSON.stringify(event)}`);
      }
    }
  }

  return textParts.join('').trim();
}
