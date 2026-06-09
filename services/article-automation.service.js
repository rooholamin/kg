import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3ClientInstance } from '@/lib/s3-client';
import { contentLog } from '@/services/content-log.service';
import { createAttempt } from '@/services/ai-attempt.service';

/**
 * Delete a list of S3 objects by their public URLs. Errors are swallowed so a
 * missing/already-deleted object never blocks the rewrite flow.
 */
async function deleteS3Assets(imageUrls) {
  const bucket = process.env.STORAGE_BUCKET;
  const cdnBase = (process.env.STORAGE_CDN_URL ?? '').replace(/\/$/, '');
  const spacesBase = `https://${bucket}.${process.env.STORAGE_REGION}.digitaloceanspaces.com`;

  const keys = imageUrls
    .filter(Boolean)
    .map((url) => {
      for (const base of [cdnBase, spacesBase]) {
        if (base && url.startsWith(base)) return url.slice(base.length).replace(/^\//, '');
      }
      return null;
    })
    .filter(Boolean);

  if (!keys.length) return;

  const s3 = getS3ClientInstance();
  await Promise.allSettled(
    keys.map((key) =>
      s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    ),
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Verify webhook secret header matches env. Throws with code UNAUTHORIZED on mismatch. */
export function verifyWebhookSecret(incomingSecret) {
  const expected = process.env.N8N_WEBHOOK_SECRET;
  if (expected && incomingSecret !== expected) {
    const err = new Error('Invalid webhook secret');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
}

/**
 * Synchronous POST to an n8n webhook. Waits for the full response (LLM included).
 * Returns { ok, data?, error? }
 */
async function callN8nWebhook(url, payload, timeoutMs = 300_000) {
  if (!url) return { ok: false, error: 'Webhook URL not configured' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Always read the body — it contains error details on non-2xx responses
    let body = null;
    let bodyText = '';
    try {
      bodyText = await res.text();
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = null;
    }

    if (!res.ok) {
      // Extract the most useful error message from the body
      const detail =
        body?.message ??
        body?.error ??
        body?.errorMessage ??
        (typeof body?.data === 'string' ? body.data : null) ??
        (bodyText.length < 500 ? bodyText : null) ??
        `HTTP ${res.status}`;
      const error = `n8n HTTP ${res.status}: ${detail}`;
      console.error('[callN8nWebhook] non-2xx response:', error, '\nBody:', bodyText.slice(0, 1000));
      return { ok: false, error };
    }

    return { ok: true, data: body };
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { ok: false, error: `Timed out after ${Math.round(timeoutMs / 1000)}s` };
    }
    return { ok: false, error: err?.message ?? 'n8n unreachable' };
  }
}

/**
 * Replace an image placeholder in article content with a real image URL.
 * Handles both HTML { type:'html', html:'...' } and TipTap { type:'doc', ... } formats.
 */
function replaceImagePlaceholder(content, placementKey, imageUrl) {
  if (!content || typeof content !== 'object') return content;

  // HTML format
  if (content.type === 'html' && typeof content.html === 'string') {
    // Match <div ... data-placement-key="KEY" ...></div> regardless of attribute order
    const escaped = placementKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `<div[^>]*data-placement-key="${escaped}"[^>]*>\\s*</div>`,
      'gi',
    );
    const updated = content.html.replace(re, `<img src="${imageUrl}" alt="${placementKey}" class="article-image" />`);
    return { ...content, html: updated };
  }

  // TipTap JSON format — walk recursively
  if (!content || typeof content !== 'object') return content;

  if (content.type === 'imagePlaceholder' && content.attrs?.placementKey === placementKey) {
    return {
      type: 'image',
      attrs: { src: imageUrl, alt: content.attrs?.prompt ?? '', title: null },
    };
  }

  if (Array.isArray(content.content)) {
    return {
      ...content,
      content: content.content.map((child) =>
        replaceImagePlaceholder(child, placementKey, imageUrl),
      ),
    };
  }

  return content;
}

// ---------------------------------------------------------------------------
// Research Workflow  (synchronous)
// ---------------------------------------------------------------------------

/**
 * Trigger n8n Research Workflow and save result immediately from the response.
 */
export async function triggerResearch(articleId, userId, opts = {}) {
  const [article, existingResearch] = await Promise.all([
    prisma.article.findUnique({
      where: { id: articleId },
      include: {
        topic: { include: { category: { include: { section: true } } } },
        category: true,
      },
    }),
    prisma.articleResearch.findUnique({ where: { articleId } }),
  ]);
  if (!article) {
    const err = new Error('Article not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const section = article.topic.category.section;

  // opts.angle overrides the article's stored angle for this run (redo with new direction)
  const payload = {
    articleId,
    title: article.title,
    summary: article.summary ?? null,
    articleAngle: opts.angle ?? article.articleAngle ?? null,
    seoKeywords: article.seoKeywords,
    outline: article.outline ?? null,
    categoryName: article.category.name,
    topicName: article.topic.name,
    targetKeyword: article.topic.targetKeyword ?? null,
    sectionName: section?.name ?? null,
  };

  const run = await prisma.articleAutomationRun.create({
    data: {
      articleId,
      workflowType: 'research',
      status: 'running',
      input: payload,
    },
  });

  await prisma.article.update({ where: { id: articleId }, data: { status: 'research' } });

  await contentLog({
    type: 'article',
    action: 'automation',
    message: `Research workflow triggered for "${article.title}"`,
    entityType: 'article',
    entityId: articleId,
    metadata: { runId: run.id },
    createdBy: userId ?? null,
  });

  const isRedo = !!(opts.angle) || !!existingResearch; // redo if research already exists or angle overridden

  const { ok, data: n8nData, error } = await callN8nWebhook(
    process.env.N8N_RESEARCH_WEBHOOK_URL,
    payload,
    300_000,
  );

  if (!ok || !n8nData) {
    await prisma.articleAutomationRun.update({
      where: { id: run.id },
      data: { status: 'failed', errorMessage: error ?? 'No data returned', updatedAt: new Date() },
    });
    await contentLog({
      type: 'article', action: 'automation',
      message: `Research failed for "${article.title}": ${error ?? 'no data'}`,
      entityType: 'article', entityId: articleId,
      metadata: { runId: run.id, error },
    });
    createAttempt({
      type: 'research',
      articleId,
      prompt: JSON.stringify(payload),
      result: error ?? 'No data returned',
      model: 'n8n/research',
      status: 'failed',
      isRedo,
      triggeredBy: userId ? 'user' : 'system',
    }).catch(() => {});
    return { run, ok: false, error };
  }

  // Parse response — n8n returns the last Code node output directly
  const parsed = Array.isArray(n8nData) ? n8nData[0]?.json ?? n8nData[0] : n8nData;

  const researchData = {
    sources: parsed.sources ?? null,
    notes: parsed.notes ?? null,
    keyFacts: parsed.keyFacts ?? null,
    searchQueries: parsed.searchQueries ?? null,
    summary: parsed.summary ?? null,
  };

  await prisma.articleResearch.upsert({
    where: { articleId },
    create: { articleId, ...researchData },
    update: researchData,
  });

  await prisma.articleAutomationRun.update({
    where: { id: run.id },
    data: { status: 'completed', output: researchData, updatedAt: new Date() },
  });

  // Research done → advance status to writing
  await prisma.article.update({ where: { id: articleId }, data: { status: 'writing' } });

  await contentLog({
    type: 'article', action: 'automation',
    message: `Research completed for "${article.title}" — status → writing`,
    entityType: 'article', entityId: articleId,
    metadata: { runId: run.id },
  });

  createAttempt({
    type: 'research',
    articleId,
    prompt: JSON.stringify(payload),
    result: parsed.summary ?? JSON.stringify(researchData).slice(0, 500),
    model: 'n8n/research',
    status: 'success',
    isRedo,
    triggeredBy: userId ? 'user' : 'system',
  }).catch(() => {});

  return { run, ok: true, research: researchData };
}

// ---------------------------------------------------------------------------
// Writing Workflow  (synchronous)
// ---------------------------------------------------------------------------

/**
 * Trigger n8n Writing Workflow and save article content + asset requests from the response.
 */
export async function triggerWriting(articleId, userId) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      research: true,
      topic: { include: { category: { include: { section: true } } } },
      category: true,
    },
  });
  if (!article) {
    const err = new Error('Article not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const section = article.topic.category.section;

  const payload = {
    articleId,
    title: article.title,
    summary: article.summary ?? null,
    articleAngle: article.articleAngle ?? null,
    outline: article.outline ?? null,
    seoKeywords: article.seoKeywords,
    categoryName: article.category.name,
    topicName: article.topic.name,
    targetKeyword: article.topic.targetKeyword ?? null,
    sectionName: section?.name ?? null,
    characterName: section?.characterName ?? null,
    characterBiography: section?.characterBiography ?? null,
    characterTone: section?.characterTone ?? null,
    characterWritingStyle: section?.characterWritingStyle ?? null,
    characterPersona: section?.characterPersona ?? null,
    characterSampleVoice: section?.characterSampleVoice ?? null,
    research: article.research
      ? {
          summary: article.research.summary,
          sources: article.research.sources,
          keyFacts: article.research.keyFacts,
          notes: article.research.notes,
        }
      : null,
  };

  const isWritingRedo = !!(article.content);

  const run = await prisma.articleAutomationRun.create({
    data: { articleId, workflowType: 'writing', status: 'running', input: payload },
  });

  await prisma.article.update({ where: { id: articleId }, data: { status: 'writing' } });

  await contentLog({
    type: 'article', action: 'automation',
    message: `Writing workflow triggered for "${article.title}"`,
    entityType: 'article', entityId: articleId,
    metadata: { runId: run.id },
    createdBy: userId ?? null,
  });

  const { ok, data: n8nData, error } = await callN8nWebhook(
    process.env.N8N_WRITING_WEBHOOK_URL,
    payload,
    600_000,
  );

  if (!ok || !n8nData) {
    await prisma.articleAutomationRun.update({
      where: { id: run.id },
      data: { status: 'failed', errorMessage: error ?? 'No data returned', updatedAt: new Date() },
    });
    await contentLog({
      type: 'article', action: 'automation',
      message: `Writing failed for "${article.title}": ${error ?? 'no data'}`,
      entityType: 'article', entityId: articleId,
      metadata: { runId: run.id, error },
    });
    createAttempt({
      type: 'writing',
      articleId,
      prompt: JSON.stringify(payload),
      result: error ?? 'No data returned',
      model: 'n8n/writing',
      status: 'failed',
      isRedo: isWritingRedo,
      triggeredBy: userId ? 'user' : 'system',
    }).catch(() => {});
    return { run, ok: false, error };
  }

  const parsed = Array.isArray(n8nData) ? n8nData[0]?.json ?? n8nData[0] : n8nData;

  // Normalise content from n8n Parse Article node.
  // Expected formats:
  //   { type: 'html', html: '<p>...</p>' }   ← new HTML format
  //   { type: 'doc', content: [...] }         ← legacy TipTap JSON
  let contentValue = parsed.content ?? null;
  if (contentValue) {
    if (typeof contentValue === 'string') {
      // Could be a raw HTML string or double-encoded JSON
      let decoded = null;
      try { decoded = JSON.parse(contentValue); } catch { /* not JSON */ }
      if (decoded && typeof decoded === 'object') {
        contentValue = decoded;
      } else {
        // Plain HTML string — wrap it
        contentValue = { type: 'html', html: contentValue };
      }
    }
    // Validate shape
    if (typeof contentValue !== 'object') {
      console.warn('[triggerWriting] unexpected content type, discarding:', typeof contentValue);
      contentValue = null;
    } else if (contentValue.type !== 'html' && contentValue.type !== 'doc') {
      console.warn('[triggerWriting] unknown content format, discarding:', contentValue.type);
      contentValue = null;
    }
  }

  if (!contentValue) {
    console.warn('[triggerWriting] No valid content returned from n8n. Raw parsed.content:', JSON.stringify(parsed?.content).slice(0, 500));
  }

  const allPrompts = [];
  if (parsed.featuredImagePrompt) {
    allPrompts.push({
      type: 'featured_image',
      prompt: parsed.featuredImagePrompt,
      placementKey: 'hero-featured',
    });
  }
  if (Array.isArray(parsed.inlineImagePrompts)) {
    for (const ip of parsed.inlineImagePrompts) {
      allPrompts.push({
        type: ip.type ?? 'inline_image',
        prompt: ip.prompt,
        placementKey: ip.placementKey,
      });
    }
  }

  // Delete previously generated images from S3 before wiping asset records
  const existingAssets = await prisma.articleAssetRequest.findMany({
    where: { articleId },
    select: { imageUrl: true },
  });
  const imageUrls = existingAssets.map((a) => a.imageUrl).filter(Boolean);
  if (imageUrls.length) {
    await deleteS3Assets(imageUrls).catch((err) =>
      console.warn('[triggerWriting] S3 cleanup partial failure:', err?.message),
    );
  }

  await prisma.$transaction(async (tx) => {
    // Wipe previous asset requests so rewrite starts clean
    await tx.articleAssetRequest.deleteMany({ where: { articleId } });

    await tx.article.update({
      where: { id: articleId },
      data: {
        title: parsed.title ?? article.title,
        summary: parsed.summary ?? article.summary,
        content: contentValue ?? article.content,
        featuredImagePrompt: parsed.featuredImagePrompt ?? article.featuredImagePrompt,
        inlineImagePrompts: parsed.inlineImagePrompts ?? article.inlineImagePrompts,
        seoKeywords: Array.isArray(parsed.seoKeywords) ? parsed.seoKeywords : article.seoKeywords,
        metaDescription: parsed.metaDescription ?? null,
        videoIdea: parsed.videoIdea ?? article.videoIdea,
        status: allPrompts.length > 0 ? 'assets' : 'approval',
      },
    });

    if (allPrompts.length > 0) {
      await tx.articleAssetRequest.createMany({
        data: allPrompts.map((p) => ({
          articleId, type: p.type, prompt: p.prompt, placementKey: p.placementKey, status: 'pending',
        })),
      });
    }

    await tx.articleVersion.create({
      data: {
        articleId,
        title: parsed.title ?? article.title,
        summary: parsed.summary ?? article.summary,
        content: contentValue ?? article.content,
        versionLabel: 'AI Written',
        createdBy: null,
      },
    });

    await tx.articleAutomationRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        output: {
          title: parsed.title,
          contentSaved: !!contentValue,
          contentType: contentValue?.type ?? 'none',
          assetRequestsCreated: allPrompts.length,
        },
        updatedAt: new Date(),
      },
    });
  });

  await contentLog({
    type: 'article', action: 'automation',
    message: `Writing completed for "${article.title}" — ${allPrompts.length} asset request(s) created`,
    entityType: 'article', entityId: articleId,
    metadata: { runId: run.id, assetRequests: allPrompts.length },
  });

  createAttempt({
    type: 'writing',
    articleId,
    prompt: JSON.stringify(payload),
    result: parsed.title ?? article.title,
    model: 'n8n/writing',
    status: 'success',
    isRedo: isWritingRedo,
    triggeredBy: userId ? 'user' : 'system',
  }).catch(() => {});

  // Re-fetch the updated article + fresh asset requests so the client
  // can update local state without a full page refresh
  const [updatedArticle, updatedAssets] = await Promise.all([
    prisma.article.findUnique({
      where: { id: articleId },
      select: { content: true, title: true, summary: true, featuredImage: true, status: true },
    }),
    prisma.articleAssetRequest.findMany({
      where: { articleId },
      orderBy: { createdAt: 'asc' },
      include: { history: { orderBy: { version: 'asc' } } },
    }),
  ]);

  return { run, ok: true, assetRequestsCreated: allPrompts.length, article: updatedArticle, assets: updatedAssets };
}

// ---------------------------------------------------------------------------
// Image Generation Workflow  (synchronous, one asset at a time)
// ---------------------------------------------------------------------------

/**
 * Trigger n8n Image Generation for each pending asset request and save results inline.
 */
export async function triggerAssets(articleId, userId, opts = {}) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) {
    const err = new Error('Article not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // opts.assetId → regenerate just one specific asset (any status)
  const pendingWhere = opts.assetId
    ? { articleId, id: opts.assetId }
    : { articleId, status: { in: ['pending', 'failed'] } };

  let pending = await prisma.articleAssetRequest.findMany({ where: pendingWhere });

  // opts.prompt → override the prompt for this run only (not persisted)
  if (opts.assetId && opts.prompt && pending.length > 0) {
    const trimmed = opts.prompt.trim();
    if (trimmed) {
      pending = [{ ...pending[0], prompt: trimmed }];
    }
  }

  if (pending.length === 0) {
    return { ok: true, triggered: 0, message: 'No matching asset requests' };
  }

  const run = await prisma.articleAutomationRun.create({
    data: {
      articleId,
      workflowType: 'image_generation',
      status: 'running',
      input: { assetRequestIds: pending.map((a) => a.id) },
    },
  });

  await contentLog({
    type: 'article', action: 'automation',
    message: `Image generation started for "${article.title}" — ${pending.length} asset(s)`,
    entityType: 'article', entityId: articleId,
    metadata: { runId: run.id },
    createdBy: userId ?? null,
  });

  let completed = 0;
  let failed = 0;
  const processedAssets = [];
  const webhookUrl = process.env.N8N_IMAGE_GEN_WEBHOOK_URL;

  for (const asset of pending) {
    await prisma.articleAssetRequest.update({
      where: { id: asset.id },
      data: { status: 'generating' },
    });

    const { ok, data: n8nData, error } = await callN8nWebhook(
      webhookUrl,
      {
        assetRequestId: asset.id,
        articleId,
        type: asset.type,
        prompt: asset.prompt,
        placementKey: asset.placementKey,
      },
      120_000,
    );

    const isRedoAsset = asset.status === 'failed'; // re-running a previously failed asset

    if (!ok || !n8nData) {
      await prisma.articleAssetRequest.update({
        where: { id: asset.id },
        data: { status: 'failed', errorMessage: error ?? 'No data returned', updatedAt: new Date() },
      });
      processedAssets.push({ ...asset, status: 'failed', errorMessage: error ?? 'No data returned' });
      createAttempt({
        type: 'image_generation',
        articleId,
        prompt: asset.prompt,
        result: error ?? 'No data returned',
        model: 'n8n/image-generation',
        status: 'failed',
        isRedo: isRedoAsset,
        triggeredBy: userId ? 'user' : 'system',
      }).catch(() => {});
      failed++;
      continue;
    }

    const parsed = Array.isArray(n8nData) ? n8nData[0]?.json ?? n8nData[0] : n8nData;
    const imageUrl = parsed.imageUrl ?? parsed.url ?? parsed.data?.[0]?.url ?? null;

    if (!imageUrl) {
      await prisma.articleAssetRequest.update({
        where: { id: asset.id },
        data: { status: 'failed', errorMessage: 'No imageUrl in response', updatedAt: new Date() },
      });
      processedAssets.push({ ...asset, status: 'failed', errorMessage: 'No imageUrl in response' });
      createAttempt({
        type: 'image_generation',
        articleId,
        prompt: asset.prompt,
        result: 'No imageUrl in response',
        model: 'n8n/image-generation',
        status: 'failed',
        isRedo: isRedoAsset,
        triggeredBy: userId ? 'user' : 'system',
      }).catch(() => {});
      failed++;
      continue;
    }

    // Mark asset done + replace placeholder in content
    let updatedContent = article.content;
    let featuredImageUpdate = {};

    if (asset.placementKey === 'hero-featured') {
      featuredImageUpdate = { featuredImage: imageUrl };
    } else if (article.content && asset.placementKey) {
      updatedContent = replaceImagePlaceholder(article.content, asset.placementKey, imageUrl);
    }

    await prisma.$transaction(async (tx) => {
      // If this asset already has an image, archive it to history before overwriting
      if (asset.imageUrl) {
        await tx.articleAssetHistory.create({
          data: {
            assetRequestId: asset.id,
            imageUrl: asset.imageUrl,
            prompt: asset.prompt,
            version: asset.version ?? 1,
          },
        });
      }

      const nextVersion = (asset.imageUrl ? (asset.version ?? 1) : 0) + 1;
      await tx.articleAssetRequest.update({
        where: { id: asset.id },
        data: { status: 'completed', imageUrl, prompt: asset.prompt, version: nextVersion, updatedAt: new Date() },
      });
      await tx.article.update({
        where: { id: articleId },
        data: { content: updatedContent, ...featuredImageUpdate },
      });
    });

    const nextVersion = (asset.imageUrl ? (asset.version ?? 1) : 0) + 1;
    processedAssets.push({ ...asset, status: 'completed', imageUrl, version: nextVersion });

    // Refresh article.content for next iteration
    article.content = updatedContent;
    if (featuredImageUpdate.featuredImage) {
      article.featuredImage = featuredImageUpdate.featuredImage;
    }

    await contentLog({
      type: 'article', action: 'automation',
      message: `Asset generated: ${asset.placementKey}`,
      entityType: 'article', entityId: articleId,
      metadata: { assetRequestId: asset.id, placementKey: asset.placementKey, imageUrl },
    });

    createAttempt({
      type: 'image_generation',
      articleId,
      prompt: asset.prompt,
      result: imageUrl,
      model: 'n8n/image-generation',
      status: 'success',
      isRedo: isRedoAsset,
      triggeredBy: userId ? 'user' : 'system',
    }).catch(() => {});

    completed++;
  }

  // Check if all assets are now done
  const stillPending = await prisma.articleAssetRequest.count({
    where: { articleId, status: { in: ['pending', 'generating'] } },
  });
  const stillFailed = await prisma.articleAssetRequest.count({
    where: { articleId, status: 'failed' },
  });

  const runStatus = failed > 0 ? 'failed' : 'completed';
  await prisma.articleAutomationRun.update({
    where: { id: run.id },
    data: { status: runStatus, output: { completed, failed }, updatedAt: new Date() },
  });

  if (stillPending === 0 && stillFailed === 0) {
    await prisma.article.update({ where: { id: articleId }, data: { status: 'approval' } });
    await contentLog({
      type: 'article', action: 'status_change',
      message: `Article "${article.title}" ready for approval — all assets generated`,
      entityType: 'article', entityId: articleId,
    });
  }

  await contentLog({
    type: 'article', action: 'automation',
    message: `Image generation finished for "${article.title}": ${completed} done, ${failed} failed`,
    entityType: 'article', entityId: articleId,
    metadata: { runId: run.id, completed, failed },
  });

  return { run, ok: true, completed, failed, total: pending.length, assets: processedAssets };
}

// ---------------------------------------------------------------------------
// Approval decisions
// ---------------------------------------------------------------------------

export async function approveArticle(articleId, userId, notes) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) {
    const err = new Error('Article not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  await prisma.article.update({
    where: { id: articleId },
    data: {
      status: 'scheduling',
      approvedById: userId ?? null,
      approvedAt: new Date(),
    },
  });

  await contentLog({
    type: 'article', action: 'status_change',
    message: `Article "${article.title}" approved — queued for WordPress publishing${notes ? `: ${notes}` : ''}`,
    entityType: 'article', entityId: articleId,
    createdBy: userId ?? null,
  });

  return { ok: true };
}

export async function rejectArticle(articleId, userId, notes) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) {
    const err = new Error('Article not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  await prisma.article.update({
    where: { id: articleId },
    data: {
      status: 'writing',
      rejectedById: userId ?? null,
      rejectedAt: new Date(),
    },
  });

  await contentLog({
    type: 'article', action: 'status_change',
    message: `Article "${article.title}" rejected — sent back to writing${notes ? `: ${notes}` : ''}`,
    entityType: 'article', entityId: articleId,
    createdBy: userId ?? null,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Manual approval (legacy — sends to approval queue)
// ---------------------------------------------------------------------------

export async function sendToApproval(articleId, userId) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) {
    const err = new Error('Article not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  await prisma.article.update({ where: { id: articleId }, data: { status: 'approval' } });

  await contentLog({
    type: 'article', action: 'status_change',
    message: `Article "${article.title}" manually sent to approval`,
    entityType: 'article', entityId: articleId,
    createdBy: userId ?? null,
  });

  return { ok: true };
}
