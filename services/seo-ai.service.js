/**
 * "seo" pipeline engine worker — per-article on-page SEO optimization only.
 * Mirrors services/social-ai.service.js / services/video-ai.service.js for
 * the Managed Agent session mechanics, but deliberately simpler: one fresh
 * session per article (no session reuse/rotation needed), and the actual
 * WordPress write happens server-side inside the agent's own update_article
 * tool call (see services/mcp-seo-tools.service.js) rather than being parsed
 * out of the agent's final reply — the reply is just a human-readable summary
 * for the audit trail.
 */
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { contentToHtml } from '@/services/wordpress.service';
import { contentLog } from '@/services/content-log.service';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

async function getSeoSettings() {
  return prisma.seoSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  });
}

/**
 * Run the SEO agent on one article. Returns { ok, error? } — same contract
 * as triggerResearch/triggerWriting/triggerAssets, so it drops directly into
 * the pipeline engine's existing error handling / skip-list behavior.
 */
export async function runSeoOptimization(articleId, userId) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { topic: true, category: true },
  });
  if (!article) return { ok: false, error: 'Article not found' };
  if (!article.wordpressPostId) {
    return { ok: false, error: 'Article has not been published to WordPress yet — nothing for the SEO engine to optimize' };
  }

  const settings = await getSeoSettings();
  if (!settings.seoAgentId || !settings.seoEnvironmentId) {
    return { ok: false, error: 'SEO Agent not configured. Set seoAgentId and seoEnvironmentId in SEO → Settings.' };
  }

  const runRow = await prisma.seoOptimizationRun.create({
    data: {
      articleId,
      status: 'running',
      previousTitle: article.title,
      previousMeta: article.metaDescription,
    },
  });

  try {
    const session = await client.beta.sessions.create({
      agent: settings.seoAgentId,
      environment_id: settings.seoEnvironmentId,
      ...(settings.mcpVaultId ? { vault_ids: [settings.mcpVaultId] } : {}),
    });

    const bodyHtml = contentToHtml(article.content);
    const message = `ARTICLE ID: ${article.id}
TITLE: ${article.title}
CURRENT META DESCRIPTION: ${article.metaDescription || '(none)'}
TARGET KEYWORD: ${article.topic?.targetKeyword || '(none)'}
CATEGORY: ${article.category?.name || ''}
TOPIC: ${article.topic?.name || ''}

CURRENT BODY (HTML):
${bodyHtml || '(empty)'}

Analyze and optimize this article's on-page SEO now. Apply every change directly with the update_article tool (pass only the field(s) you're actually changing — you may call it more than once if that's easier). When you're done, reply with a short plain-text summary of what you changed and why (this is stored for our own audit trail, not shown to a reader).`;

    const responseText = await sendAndAwaitResponse(session.id, message);

    await prisma.seoOptimizationRun.update({
      where: { id: runRow.id },
      data: {
        status: 'completed',
        changesSummary: responseText.slice(0, 4000),
        agentSessionId: session.id,
      },
    });

    await prisma.article.update({
      where: { id: articleId },
      data: { seoOptimized: true, seoOptimizedAt: new Date() },
    });

    await contentLog({
      type: 'article',
      action: 'automation',
      message: `SEO optimization completed for "${article.title}"`,
      entityType: 'article',
      entityId: articleId,
      createdBy: userId ?? null,
    });

    return { ok: true, summary: responseText };
  } catch (err) {
    const errorMessage = err?.message ?? 'SEO agent session failed';
    await prisma.seoOptimizationRun.update({
      where: { id: runRow.id },
      data: { status: 'failed', errorMessage },
    }).catch(() => {});
    return { ok: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Helpers — session send/stream, same event contract as social-ai/video-ai.
// A single retry on a dropped turn is safe here (unlike video generation):
// re-sending the same brief just re-applies the same/similar SEO fixes rather
// than spending a real generation credit twice.
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
        // A resumed dropped turn can replay both answers on one stream —
        // keep only the most recent (see video-ai.service.js for the
        // confirmed-in-production failure mode this guards against).
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
