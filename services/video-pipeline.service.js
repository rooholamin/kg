import { prisma } from '@/lib/prisma';
import {
  selectVideoArticles,
  planVideoPost,
  executeVideoPost,
  regenerateVideoSegment,
  resolveVideoConfig,
} from './video-ai.service';
import { assembleVideo, regenerateMusicOnly } from './video-assembly.service';
import { deleteFromS3 } from './social-export.service';
import { scheduleVideoPost as bufferScheduleVideoPost, unscheduleVideoPost as bufferUnscheduleVideoPost, pullVideoAnalytics } from './buffer.service';
import { logStart, logDone, logError, logInfo } from '@/lib/video-logger';

// ---------------------------------------------------------------------------
// getVideoSettings / getVideoAiMemory helpers — mirrors
// getSocialSettings/getSocialAiMemory in social-pipeline.service.js.
// ---------------------------------------------------------------------------
async function getVideoSettings() {
  return prisma.videoSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

async function getVideoAiMemory() {
  return prisma.videoAiMemory.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

async function getVideoEnvironment() {
  return prisma.videoEnvironment.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

async function getRecentPromptLearnings(limit = 10) {
  return prisma.videoPromptLearning.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

function musicPromptFor(article, config, note) {
  const styleWords = {
    explainer: 'clear, focused, gently building',
    diy: 'warm, relaxed, craftsman workshop feel',
    listicle: 'upbeat but calm, tidy and structured',
    testimonial: 'warm, intimate, conversational',
    auto: 'warm, unobtrusive',
  };
  const mood = styleWords[config.style] || styleWords.auto;
  const noteText = note ? ` Additional direction: ${note}.` : '';
  return `${mood} instrumental background music for a short-form video about "${article.title}" — no vocals, no drums or only very light percussion, sits gently under spoken narration, subtle enough not to compete with voice.${noteText}`;
}

// ---------------------------------------------------------------------------
// 1. runVideoApproval — unchanged: selects which articles get a video this
// cycle, creates VideoPost rows with status "pending".
// ---------------------------------------------------------------------------
export async function runVideoApproval(campaignId) {
  const campaign = await prisma.videoCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

  await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'approving' } });
  await logInfo(campaignId, 'pipeline_start', 'Pipeline started');

  const settings = await getVideoSettings();
  const memory = await getVideoAiMemory();

  const articleFrom = campaign.articleDateStart ?? campaign.weekStart;
  const articleTo = campaign.articleDateEnd ?? campaign.weekEnd;

  const fetchLogId = await logStart(campaignId, 'approval_fetch', 'Fetching published articles for the campaign');
  const articles = await prisma.article.findMany({
    where: {
      status: 'post_publish',
      publishDate: { gte: articleFrom, lte: articleTo },
      ...(campaign.editorsChoiceOnly ? { isEditorsChoice: true } : {}),
      ...(campaign.includeSections?.length
        ? { category: { section: { slug: { in: campaign.includeSections } } } }
        : {}),
    },
    include: { category: { include: { section: true } }, topic: true },
  });

  if (!articles.length) {
    await logError(fetchLogId, 'No eligible published articles found in the selected date range');
    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'failed' } });
    throw new Error('No eligible articles found in the selected date range');
  }

  const eligibleArticles = articles.filter((a) => a.category?.section?.videoCharacterId);
  if (!eligibleArticles.length) {
    await logError(fetchLogId, 'No eligible articles belong to a section with a trained video character');
    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'failed' } });
    throw new Error('No section with a trained video character has an eligible article in this range');
  }

  await logDone(fetchLogId, `Found ${eligibleArticles.length} article${eligibleArticles.length !== 1 ? 's' : ''}`, {
    titles: eligibleArticles.map((a) => a.title),
  });

  const articlesForAI = eligibleArticles.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    sectionName: a.category?.section?.name,
    categoryName: a.category?.name,
  }));

  const approvedArticleIds = await selectVideoArticles({ articles: articlesForAI, campaign, settings, memory });

  const validIds = new Set(eligibleArticles.map((a) => a.id));
  const postCreateData = approvedArticleIds
    .filter((id) => validIds.has(id))
    .map((articleId) => ({ campaignId, articleId, status: 'pending' }));

  if (postCreateData.length) {
    await prisma.videoPost.createMany({ data: postCreateData });
  }

  await logInfo(campaignId, 'approval_posts_created', `Created ${postCreateData.length} video post${postCreateData.length !== 1 ? 's' : ''} from approval`);

  return postCreateData.length;
}

// ---------------------------------------------------------------------------
// 2. runVideoPlanning — Phase 1 for every pending post in a campaign. Drafts
// a narration + segment breakdown (no Higgsfield spend) and moves each post
// to "plan_ready" for human review, or "failed" if planning itself errors.
// ---------------------------------------------------------------------------
export async function runVideoPlanning(campaignId) {
  const posts = await prisma.videoPost.findMany({
    where: { campaignId, status: 'pending' },
    include: { article: { include: { category: { include: { section: true } } } } },
  });

  if (!posts.length) return 0;

  await logInfo(campaignId, 'planning_start', `Starting planning for ${posts.length} post${posts.length !== 1 ? 's' : ''}`);

  const settings = await getVideoSettings();
  const campaign = await prisma.videoCampaign.findUnique({ where: { id: campaignId } });
  const environment = await getVideoEnvironment();

  let succeeded = 0;
  for (const post of posts) {
    const current = await prisma.videoCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (current?.status === 'cancelled' || current?.status === 'paused') break;

    try {
      const section = post.article.category?.section;
      if (!section?.videoCharacterId) throw new Error('Article\'s section has no trained video character');

      await prisma.videoPost.update({ where: { id: post.id }, data: { status: 'planning' } });
      const config = resolveVideoConfig({ post, campaign, settings });

      const { plan } = await planVideoPost({
        campaignId,
        postId: post.id,
        article: post.article,
        section,
        environment,
        config,
        existingPlan: post.plan,
        directorNote: post.directorNote,
        settings,
      });

      await prisma.videoPost.update({
        where: { id: post.id },
        data: {
          status: 'plan_ready',
          plan,
          narration: plan.narration || null,
          generatedText: plan.text || null,
          hashtags: plan.hashtags || [],
          genre: plan.genre || null,
        },
      });
      succeeded++;
    } catch (error) {
      await prisma.videoPost.update({
        where: { id: post.id },
        data: { status: 'failed', errorMessage: error.message },
      });
    }
  }

  await logInfo(campaignId, 'planning_done', `Planning complete — ${succeeded}/${posts.length} succeeded`);
  return succeeded;
}

// ---------------------------------------------------------------------------
// 2b. rePlanPost — re-draft the plan for one post (Phase 1 again), reusing
// the same director session so revision notes land with full context.
// ---------------------------------------------------------------------------
export async function rePlanPost(postId, directorNote) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: { article: { include: { category: { include: { section: true } } } } },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const settings = await getVideoSettings();
  const campaign = await prisma.videoCampaign.findUnique({ where: { id: post.campaignId } });
  const environment = await getVideoEnvironment();
  const section = post.article.category?.section;
  if (!section?.videoCharacterId) throw new Error('Article\'s section has no trained video character');

  await prisma.videoPost.update({ where: { id: postId }, data: { status: 'planning', errorMessage: null } });
  const config = resolveVideoConfig({ post, campaign, settings });

  try {
    const { plan } = await planVideoPost({
      campaignId: post.campaignId,
      postId,
      article: post.article,
      section,
      environment,
      config,
      existingPlan: post.plan,
      directorNote: directorNote || post.directorNote || undefined,
      settings,
    });

    await prisma.videoPost.update({
      where: { id: postId },
      data: {
        status: 'plan_ready',
        plan,
        narration: plan.narration || null,
        generatedText: plan.text || null,
        hashtags: plan.hashtags || [],
        genre: plan.genre || null,
        directorNote: directorNote || post.directorNote || null,
      },
    });
    return plan;
  } catch (error) {
    await prisma.videoPost.update({ where: { id: postId }, data: { status: 'failed', errorMessage: error.message } });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 3. approvePlan — Phase 2 -> Phase 3. Human approves (optionally edited)
// plan; triggers real Higgsfield generation for every planned segment.
// ---------------------------------------------------------------------------
export async function approvePlan(postId, { editedPlan, directorNote } = {}) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: { article: { include: { category: { include: { section: true } } } } },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);
  if (!post.plan) throw new Error('Post has no draft plan to approve — run planning first.');

  const section = post.article.category?.section;
  if (!section?.videoCharacterId) throw new Error('Article\'s section has no trained video character');

  const settings = await getVideoSettings();
  const campaign = await prisma.videoCampaign.findUnique({ where: { id: post.campaignId } });
  const environment = await getVideoEnvironment();
  const promptLearnings = await getRecentPromptLearnings();
  const config = resolveVideoConfig({ post, campaign, settings });

  const plan = editedPlan || post.plan;

  await prisma.videoPost.update({
    where: { id: postId },
    data: {
      status: 'approved',
      plan,
      narration: plan.narration || post.narration,
      directorNote: directorNote ?? post.directorNote,
    },
  });

  await prisma.videoPost.update({ where: { id: postId }, data: { status: 'directing' } });

  try {
    const { result } = await executeVideoPost({
      campaignId: post.campaignId,
      postId,
      article: post.article,
      section,
      environment,
      config,
      plan,
      directorNote: directorNote ?? post.directorNote,
      settings,
      promptLearnings,
    });

    const segments = await prisma.videoSegment.findMany({ where: { postId } });
    const anySucceeded = segments.some((s) => s.status === 'completed');

    await prisma.videoPost.update({
      where: { id: postId },
      data: {
        status: anySucceeded ? 'directing' : 'failed',
        narration: result.narration || plan.narration,
        generatedText: result.text || post.generatedText,
        hashtags: result.hashtags || post.hashtags,
        genre: result.genre || post.genre,
        errorMessage: anySucceeded ? null : 'All segments failed to generate',
      },
    });

    return result;
  } catch (error) {
    await prisma.videoPost.update({ where: { id: postId }, data: { status: 'failed', errorMessage: error.message } });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 4. regenerateSegment — redo exactly one segment, without touching the
// rest or the post's assembled video (assembly is always a separate,
// manual step — see reassemblePost below).
// ---------------------------------------------------------------------------
export async function regenerateSegment(segmentId, note) {
  const segment = await prisma.videoSegment.findUnique({ where: { id: segmentId } });
  if (!segment) throw new Error(`Segment not found: ${segmentId}`);

  const staleUrl = segment.videoUrl;
  const updated = await regenerateVideoSegment({ postId: segment.postId, segment, note });

  if (staleUrl && staleUrl !== updated.videoUrl) {
    await deleteFromS3(staleUrl).catch(() => {});
  }

  return updated;
}

// ---------------------------------------------------------------------------
// 5. reassemblePost — ALWAYS a manual, standalone trigger (never auto-run
// after planning/execution/segment regeneration). Concatenates every
// completed segment, mixes in duration-matched music, optionally applies
// Captions.ai, uploads the result, and updates the post's aggregate
// cost/time fields.
// ---------------------------------------------------------------------------
export async function reassemblePost(postId) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: { article: true, segments: { orderBy: { order: 'asc' } } },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const settings = await getVideoSettings();
  const campaign = await prisma.videoCampaign.findUnique({ where: { id: post.campaignId } });
  const config = resolveVideoConfig({ post, campaign, settings });

  const completedSegments = post.segments.filter((s) => s.status === 'completed' && s.videoUrl);
  if (!completedSegments.length) {
    throw new Error('No completed segments to assemble yet.');
  }

  const staleUrls = [post.videoUrl, post.musicUrl, post.narrationVideoUrl].filter(Boolean);

  const logId = await logStart(post.campaignId, 'assembly_start', `Assembling ${completedSegments.length} segment(s)`, null, postId);

  try {
    const captionsEnabled = post.captionsEnabled ?? settings.captionsEnabled;
    const effectiveVolume = post.musicVolume ?? settings.musicVolume;
    // Skip generating music entirely if it would just be mixed at 0 volume —
    // no reason to spend a real ElevenLabs credit on an inaudible track.
    const musicEnabled = settings.musicEnabled && effectiveVolume > 0;

    const { videoUrl, narrationVideoUrl, musicUrl, duration, captionsApplied, captionsSkipReason, additionalCost } = await assembleVideo({
      post,
      segments: post.segments,
      orientation: config.orientation,
      musicConfig: musicEnabled
        ? {
            enabled: true,
            volume: effectiveVolume,
            prompt: musicPromptFor(post.article, config),
            modelId: settings.elevenlabsMusicModelId,
          }
        : { enabled: false },
      captionsConfig: captionsEnabled
        ? { enabled: true, templateId: settings.captionsTemplateId }
        : { enabled: false },
      outroConfig: {
        enabled: Boolean(settings.outroEnabled && settings.outroVideoUrl),
        videoUrl: settings.outroVideoUrl,
      },
    });

    const segmentCost = post.segments.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);
    const segmentTimeMs = post.segments.reduce((sum, s) => {
      if (s.generationStartedAt && s.generationCompletedAt) {
        return sum + (new Date(s.generationCompletedAt) - new Date(s.generationStartedAt));
      }
      return sum;
    }, 0);

    await prisma.videoPost.update({
      where: { id: postId },
      data: {
        status: 'content_ready',
        videoUrl,
        narrationVideoUrl,
        musicUrl,
        duration,
        aspectRatio: config.orientation,
        totalEstimatedCost: Math.round((segmentCost + additionalCost) * 100) / 100,
        totalGenerationTimeMs: segmentTimeMs,
        errorMessage: null,
      },
    });

    await logDone(
      logId,
      `Assembled — ${duration}s${captionsApplied ? ', captions applied' : captionsEnabled ? ` (captions skipped: ${captionsSkipReason || 'unknown'})` : ''}`,
      { videoUrl, musicUrl, duration, captionsApplied, captionsSkipReason },
    );

    if (staleUrls.length) {
      await Promise.allSettled(staleUrls.map(deleteFromS3));
    }

    if (!settings.requireReview) {
      await schedulePost(postId);
    }

    return { videoUrl, musicUrl, duration, captionsApplied, captionsSkipReason };
  } catch (err) {
    await logError(logId, err.message);
    await prisma.videoPost.update({ where: { id: postId }, data: { errorMessage: err.message } });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 5b. regenerateMusic — swaps in a fresh music track without re-touching
// Higgsfield or re-downloading/re-normalizing/re-concatenating segments;
// reuses the base render saved by the last full Re-assemble. Re-applies
// captions afterward if enabled, since Captions.ai works on the final mix.
// ---------------------------------------------------------------------------
export async function regenerateMusic(postId, note) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: { article: true },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);
  if (!post.narrationVideoUrl) {
    throw new Error('No assembled video yet — run Re-assemble at least once before regenerating music.');
  }

  const settings = await getVideoSettings();
  const campaign = await prisma.videoCampaign.findUnique({ where: { id: post.campaignId } });
  const config = resolveVideoConfig({ post, campaign, settings });

  const staleUrls = [post.videoUrl, post.musicUrl].filter(Boolean);
  const logId = await logStart(post.campaignId, 'music_regenerate', 'Regenerating background music', { note }, postId);

  try {
    const captionsEnabled = post.captionsEnabled ?? settings.captionsEnabled;
    const effectiveVolume = post.musicVolume ?? settings.musicVolume;
    const musicEnabled = settings.musicEnabled && effectiveVolume > 0;
    if (!musicEnabled) {
      throw new Error('Music is disabled or muted for this post (volume is 0) — nothing to regenerate.');
    }

    const { videoUrl, musicUrl, duration, captionsApplied, captionsSkipReason, additionalCost } = await regenerateMusicOnly({
      post,
      orientation: config.orientation,
      musicConfig: {
        enabled: true,
        volume: effectiveVolume,
        prompt: musicPromptFor(post.article, config, note),
        modelId: settings.elevenlabsMusicModelId,
      },
      captionsConfig: captionsEnabled
        ? { enabled: true, templateId: settings.captionsTemplateId }
        : { enabled: false },
    });

    await prisma.videoPost.update({
      where: { id: postId },
      data: {
        videoUrl,
        musicUrl,
        duration,
        totalEstimatedCost: post.totalEstimatedCost ? Math.round((post.totalEstimatedCost + additionalCost) * 100) / 100 : additionalCost,
        errorMessage: null,
      },
    });

    await logDone(logId, `Music regenerated${captionsApplied ? ', captions re-applied' : ''}`, { videoUrl, musicUrl, captionsApplied, captionsSkipReason });

    if (staleUrls.length) {
      await Promise.allSettled(staleUrls.map(deleteFromS3));
    }

    return { videoUrl, musicUrl, duration, captionsApplied, captionsSkipReason };
  } catch (err) {
    await logError(logId, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 6. schedulePost / unschedulePost — unchanged from previous pipeline; the
// assembled video already lives on Spaces (assembleVideo uploads directly),
// so there's no separate "export" download/re-upload step anymore. "export"
// now just means: finalize target platforms and move the post from
// content_ready -> uploaded, ready to schedule.
// ---------------------------------------------------------------------------
export async function runExport(postId) {
  const settings = await getVideoSettings();
  const post = await prisma.videoPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error(`Post not found: ${postId}`);

  if (!post.videoUrl) {
    throw new Error('Post has no assembled video yet — run/re-assemble first.');
  }

  await prisma.videoPost.update({
    where: { id: postId },
    data: {
      status: 'uploaded',
      platforms: post.platforms?.length ? post.platforms : settings.defaultPlatforms,
      errorMessage: null,
    },
  });

  if (!settings.requireReview) {
    await schedulePost(postId);
  }
}

export async function schedulePost(postId) {
  const post = await prisma.videoPost.findUnique({ where: { id: postId }, select: { campaignId: true, scheduledAt: true } });

  const logId = await logStart(post?.campaignId, 'schedule_buffer', 'Scheduling video post via Buffer', { scheduledAt: post?.scheduledAt }, postId);

  try {
    const bufferPostIds = await bufferScheduleVideoPost({ postId });
    await logDone(logId, `Scheduled to ${Object.keys(bufferPostIds || {}).length} channel(s)`, { bufferPostIds });
    return bufferPostIds;
  } catch (err) {
    await logError(logId, err.message);
    throw err;
  }
}

export async function unschedulePost(postId) {
  const post = await prisma.videoPost.findUnique({ where: { id: postId }, select: { campaignId: true, bufferPostIds: true } });

  const logId = await logStart(post?.campaignId, 'unschedule_buffer', 'Removing video post from Buffer', { bufferPostIds: post?.bufferPostIds }, postId);

  try {
    await bufferUnscheduleVideoPost(postId);
    await logDone(logId, 'Removed from Buffer — post reverted to "uploaded"');
  } catch (err) {
    await logError(logId, err.message);
    throw err;
  }
}

const BUFFER_SCHEDULE_DELAY_MS = 1500;
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scheduleAllPosts(campaignId) {
  const posts = await prisma.videoPost.findMany({ where: { campaignId, status: 'uploaded' } });

  await logInfo(campaignId, 'schedule_all_start', `Scheduling ${posts.length} post${posts.length !== 1 ? 's' : ''} via Buffer`);

  let succeeded = 0;
  for (const [index, post] of posts.entries()) {
    try {
      await schedulePost(post.id);
      succeeded++;
    } catch (err) {
      console.error(`[scheduleAllPosts] post ${post.id} failed:`, err.message);
    }
    if (index < posts.length - 1) await sleep(BUFFER_SCHEDULE_DELAY_MS);
  }

  await logInfo(campaignId, 'schedule_all_done', `Scheduled ${succeeded}/${posts.length} post${posts.length !== 1 ? 's' : ''}`);
  await checkAndFinalizeCampaign(campaignId);
  return succeeded;
}

// ---------------------------------------------------------------------------
// 5b. rePlanAllPosts — bulk re-draft (Phase 1 only, no Higgsfield spend) for
// every post not yet approved/executing/scheduled. Deliberately does NOT
// re-execute already-approved posts — that would re-spend real generation
// credits in bulk, defeating the whole point of per-post approval.
// ---------------------------------------------------------------------------
export async function rePlanAllPosts(campaignId, directorNote) {
  const posts = await prisma.videoPost.findMany({
    where: { campaignId, status: { in: ['pending', 'plan_ready', 'failed'] } },
  });
  if (!posts.length) return { count: 0, succeeded: 0 };

  await logInfo(campaignId, 'replan_all_start', `Re-planning ${posts.length} post${posts.length !== 1 ? 's' : ''}`);

  let succeeded = 0;
  for (const post of posts) {
    try {
      await rePlanPost(post.id, directorNote);
      succeeded++;
    } catch (error) {
      console.error(`[rePlanAllPosts] post ${post.id} failed:`, error.message);
    }
  }

  await logInfo(campaignId, 'replan_all_done', `Re-planned ${succeeded}/${posts.length} post${posts.length !== 1 ? 's' : ''}`);
  return { count: posts.length, succeeded };
}

export async function exportAllContent(campaignId) {
  const posts = await prisma.videoPost.findMany({ where: { campaignId, status: 'content_ready' } });
  if (!posts.length) return 0;

  await logInfo(campaignId, 'export_all_start', `Exporting ${posts.length} post${posts.length !== 1 ? 's' : ''}`);

  const results = await Promise.allSettled(posts.map((p) => runExport(p.id)));
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;

  await logInfo(campaignId, 'export_all_done', `Exported ${succeeded}/${posts.length} post${posts.length !== 1 ? 's' : ''}`);
  await checkAndFinalizeCampaign(campaignId);
  return succeeded;
}

export async function retryFailedExports(campaignId) {
  const posts = await prisma.videoPost.findMany({ where: { campaignId, status: 'failed', videoUrl: { not: null } } });

  await logInfo(campaignId, 'retry_failed_start', `Retrying export for ${posts.length} failed post${posts.length !== 1 ? 's' : ''}`);

  const results = await Promise.allSettled(posts.map((p) => runExport(p.id)));
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;

  await logInfo(campaignId, 'retry_failed_done', `Retried ${posts.length} post${posts.length !== 1 ? 's' : ''} — ${succeeded} succeeded`);
  await checkAndFinalizeCampaign(campaignId);
  return succeeded;
}

// ---------------------------------------------------------------------------
// 7. runFullPipeline — fire-and-forget: approval → planning. Stops there —
// execution now always requires an explicit human plan approval, and
// assembly is always a separate manual trigger (see approvePlan/reassemblePost).
// ---------------------------------------------------------------------------
export async function runFullPipeline(campaignId) {
  try {
    await runVideoApproval(campaignId);

    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'planning' } });
    await runVideoPlanning(campaignId);

    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'reviewing' } });
  } catch (error) {
    console.error('[video-pipeline.runFullPipeline]', error);
    await logInfo(campaignId, 'pipeline_error', `Pipeline failed: ${error.message}`);
    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'failed' } });
  }
}

// ---------------------------------------------------------------------------
// 8. checkAndFinalizeCampaign
// ---------------------------------------------------------------------------
export async function checkAndFinalizeCampaign(campaignId) {
  const posts = await prisma.videoPost.findMany({ where: { campaignId }, select: { status: true } });
  if (!posts.length) return;

  const allDone = posts.every((p) => p.status === 'scheduled' || p.status === 'failed');
  const anyScheduled = posts.some((p) => p.status === 'scheduled');

  if (allDone) {
    const finalStatus = anyScheduled ? 'done' : 'failed';
    await logInfo(campaignId, 'pipeline_complete', `Campaign finalized as "${finalStatus}"`);
    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: finalStatus } });
  } else {
    const settings = await getVideoSettings();
    if (settings.requireReview) {
      await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'reviewing' } });
    }
  }
}

// ---------------------------------------------------------------------------
// 9. resumePipeline
// ---------------------------------------------------------------------------
export async function resumePipeline(campaignId) {
  await logInfo(campaignId, 'pipeline_resume', 'Pipeline resumed by user');

  await prisma.videoPost.updateMany({
    where: { campaignId, status: 'planning' },
    data: { status: 'pending', errorMessage: null },
  });
  await prisma.videoPost.updateMany({
    where: { campaignId, status: 'exporting' },
    data: { status: 'content_ready', errorMessage: null },
  });

  const pendingCount = await prisma.videoPost.count({ where: { campaignId, status: 'pending' } });

  if (pendingCount > 0) {
    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'planning' } });
    await runVideoPlanning(campaignId);
  }

  await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'reviewing' } });
  await checkAndFinalizeCampaign(campaignId);
}

// ---------------------------------------------------------------------------
// 10. pullAnalyticsForCampaign
// ---------------------------------------------------------------------------
export async function pullAnalyticsForCampaign(campaignId) {
  const posts = await prisma.videoPost.findMany({
    where: { campaignId, status: 'scheduled', bufferPostIds: { not: null } },
  });
  await Promise.allSettled(posts.map((p) => pullVideoAnalytics(p.id)));
}
