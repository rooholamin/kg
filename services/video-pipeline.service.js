import { prisma } from '@/lib/prisma';
import {
  selectVideoArticles,
  planVideoPost,
  generateVideoStills,
  regenerateVideoStill,
  shootVideoPost,
  continueVideoPost,
  regenerateVideoSegment,
  resolveVideoConfig,
  extractPlainText,
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

// ---------------------------------------------------------------------------
// videoArticleEligibilityWhere — shared candidate-article filter used by both
// the agent-driven approval query (runVideoApproval) and the manual
// day-by-day browser (eligible-articles-by-day route). Articles just need to
// be past editorial approval (not necessarily live/published yet), with no
// publish-date bound — and are excluded once claimed by an active SocialPost
// (so the same story never gets both a carousel and a video) or once they've
// already produced a real (non-failed) VideoPost in any prior campaign (so
// the same article is never picked for video twice).
// ---------------------------------------------------------------------------
const VIDEO_ELIGIBLE_ARTICLE_STATUSES = ['approval', 'scheduling', 'publishing', 'post_publish'];

export function videoArticleEligibilityWhere({ editorsChoiceOnly, includeSections } = {}) {
  return {
    status: { in: VIDEO_ELIGIBLE_ARTICLE_STATUSES },
    ...(editorsChoiceOnly ? { isEditorsChoice: true } : {}),
    category: {
      section: {
        videoCharacterId: { not: null },
        ...(includeSections?.length ? { slug: { in: includeSections } } : {}),
      },
    },
    socialPosts: { none: { status: { not: 'failed' } } },
    videoPosts: { none: { status: { not: 'failed' } } },
  };
}

function musicPromptFor(title, config, note) {
  const styleWords = {
    explainer: 'clear, focused, gently building',
    diy: 'warm, relaxed, craftsman workshop feel',
    listicle: 'upbeat but calm, tidy and structured',
    testimonial: 'warm, intimate, conversational',
    auto: 'warm, unobtrusive',
  };
  const mood = styleWords[config.style] || styleWords.auto;
  const noteText = note ? ` Additional direction: ${note}.` : '';
  return `${mood} instrumental background music for a short-form video about "${title}" — no vocals, no drums or only very light percussion, sits gently under spoken narration, subtle enough not to compete with voice.${noteText}`;
}

// A section's video character lives inline on the Section row (as opposed to
// the standalone VideoCharacter roster) — this flattens it into the same shape
// both kinds of character are consumed as downstream.
function characterFromSection(section) {
  if (!section) return null;
  return {
    name: section.characterName,
    persona: section.characterPersona || section.characterBiography,
    tone: section.characterTone,
    videoCharacterId: section.videoCharacterId,
  };
}

// ---------------------------------------------------------------------------
// resolvePostContent — normalizes a post's title/summary/content/character
// regardless of whether it's derived from an article+section (normal post)
// or provided directly as a custom video (customTitle/customContent + either
// a roster customCharacter or a borrowed customSection character). Every
// planVideoPost/generateVideoStills caller goes through this so those two
// functions never need to know which kind of post they're working with.
// ---------------------------------------------------------------------------
function resolvePostContent(post) {
  if (post.article) {
    return {
      title: post.article.title,
      summary: post.article.summary,
      contentText: extractPlainText(post.article.content),
      character: characterFromSection(post.article.category?.section),
    };
  }

  const roster = post.customCharacter;
  return {
    title: post.customTitle,
    summary: null,
    contentText: post.customContent,
    character: post.customSection
      ? characterFromSection(post.customSection)
      : roster
        ? { name: roster.name, persona: roster.persona, tone: roster.tone, videoCharacterId: roster.videoCharacterId }
        : null,
  };
}

// A custom video can be shot somewhere other than the shared KG Media Loft —
// its own environment description replaces the global VideoEnvironment
// singleton for that one post. Only `name`/`textDescriptor` are ever read
// downstream (the environment reaches the agent as text, never as an image
// ref), so a plain object stands in for the singleton row.
function resolveEnvironment(post, globalEnvironment) {
  if (!post.customEnvironmentDescription) return globalEnvironment;
  return {
    name: post.customEnvironmentName || 'Custom environment',
    textDescriptor: post.customEnvironmentDescription,
  };
}

// A post's campaign is optional (custom videos can stand entirely on their
// own) — this avoids every caller repeating the same null guard, since
// Prisma's findUnique throws if `id` is null rather than just returning null.
async function findCampaignOrNull(campaignId) {
  if (!campaignId) return null;
  return prisma.videoCampaign.findUnique({ where: { id: campaignId } });
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

  const fetchLogId = await logStart(campaignId, 'approval_fetch', 'Fetching eligible articles for the campaign');
  const articles = await prisma.article.findMany({
    where: videoArticleEligibilityWhere({
      editorsChoiceOnly: campaign.editorsChoiceOnly,
      includeSections: campaign.includeSections,
    }),
    include: { category: { include: { section: true } }, topic: true },
  });

  if (!articles.length) {
    await logError(fetchLogId, 'No eligible articles found — either none are past approval stage, or all are already claimed by a social/video post');
    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'failed' } });
    throw new Error('No eligible articles found');
  }

  await logDone(fetchLogId, `Found ${articles.length} article${articles.length !== 1 ? 's' : ''}`, {
    titles: articles.map((a) => a.title),
  });

  const articlesForAI = articles.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    sectionName: a.category?.section?.name,
    categoryName: a.category?.name,
  }));

  const approvedArticleIds = await selectVideoArticles({ articles: articlesForAI, campaign, settings, memory });

  const validIds = new Set(articles.map((a) => a.id));
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
// 1b. createManualVideoPosts — the manual-selection counterpart to
// runVideoApproval: skips the approval agent entirely and creates VideoPost
// rows directly for whatever articleIds the human picked in the day-by-day
// wizard. Re-validates eligibility and the per-day cap server-side (defense
// in depth — the wizard already enforces both client-side).
// ---------------------------------------------------------------------------
export async function createManualVideoPosts(campaignId, articleIds, maxPerDay) {
  if (!articleIds?.length) return 0;

  const articles = await prisma.article.findMany({
    where: { id: { in: articleIds }, ...videoArticleEligibilityWhere({}) },
    select: { id: true, publishDate: true },
  });

  if (maxPerDay) {
    const countByDay = new Map();
    for (const a of articles) {
      const day = a.publishDate ? new Date(a.publishDate).toISOString().slice(0, 10) : 'unknown';
      countByDay.set(day, (countByDay.get(day) || 0) + 1);
    }
    for (const [day, count] of countByDay) {
      if (count > maxPerDay) {
        throw new Error(`${count} articles selected for ${day}, exceeding the max of ${maxPerDay} per day`);
      }
    }
  }

  const validIds = new Set(articles.map((a) => a.id));
  const postCreateData = articleIds
    .filter((id) => validIds.has(id))
    .map((articleId) => ({ campaignId, articleId, status: 'pending' }));

  if (postCreateData.length) {
    await prisma.videoPost.createMany({ data: postCreateData });
  }

  await logInfo(campaignId, 'manual_posts_created', `Created ${postCreateData.length} video post${postCreateData.length !== 1 ? 's' : ''} from manual selection`);

  return postCreateData.length;
}

// ---------------------------------------------------------------------------
// planOnePost — shared Phase 1 body used by both runVideoPlanning (campaign
// posts) and planStandaloneCustomPost (a campaign-less custom video) so
// there's exactly one place that resolves content/character and calls
// planVideoPost.
// ---------------------------------------------------------------------------
async function planOnePost(post, { campaignId, campaign, settings, environment }) {
  const content = resolvePostContent(post);
  if (!content.character?.videoCharacterId) {
    throw new Error(`Character "${content.character?.name || 'unknown'}" has no trained video character`);
  }

  await prisma.videoPost.update({ where: { id: post.id }, data: { status: 'planning' } });
  const config = resolveVideoConfig({ post, campaign, settings });

  const { plan } = await planVideoPost({
    campaignId,
    postId: post.id,
    title: content.title,
    summary: content.summary,
    contentText: content.contentText,
    character: content.character,
    environment: resolveEnvironment(post, environment),
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

  return plan;
}

// ---------------------------------------------------------------------------
// 2. runVideoPlanning — Phase 1 for every pending post in a campaign. Drafts
// a narration + segment breakdown (no Higgsfield spend) and moves each post
// to "plan_ready" for human review, or "failed" if planning itself errors.
// ---------------------------------------------------------------------------
export async function runVideoPlanning(campaignId) {
  const posts = await prisma.videoPost.findMany({
    where: { campaignId, status: 'pending' },
    include: {
      article: { include: { category: { include: { section: true } } } },
      customCharacter: true,
      customSection: true,
    },
  });

  if (!posts.length) return 0;

  await logInfo(campaignId, 'planning_start', `Starting planning for ${posts.length} post${posts.length !== 1 ? 's' : ''}`);

  const settings = await getVideoSettings();
  const campaign = await findCampaignOrNull(campaignId);
  // The global default — planOnePost applies each post's own override, if any
  const environment = await getVideoEnvironment();

  let succeeded = 0;
  for (const post of posts) {
    const current = await findCampaignOrNull(campaignId);
    if (current?.status === 'cancelled' || current?.status === 'paused') break;

    try {
      await planOnePost(post, { campaignId, campaign, settings, environment });
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
// 2c. planStandaloneCustomPost — Phase 1 for a single campaign-less custom
// video (see app/api/video/custom-posts). Shares planOnePost with
// runVideoPlanning; the only difference is there's no campaignId to scope a
// query by, so it's called directly for the one post just created.
// ---------------------------------------------------------------------------
export async function planStandaloneCustomPost(postId) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: { customCharacter: true, customSection: true },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const settings = await getVideoSettings();
  const environment = await getVideoEnvironment();

  try {
    return await planOnePost(post, { campaignId: null, campaign: null, settings, environment });
  } catch (error) {
    await prisma.videoPost.update({ where: { id: postId }, data: { status: 'failed', errorMessage: error.message } });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 2b. rePlanPost — re-draft the plan for one post (Phase 1 again), reusing
// the same director session so revision notes land with full context.
// ---------------------------------------------------------------------------
export async function rePlanPost(postId, directorNote) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: {
      article: { include: { category: { include: { section: true } } } },
      customCharacter: true,
      customSection: true,
    },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const settings = await getVideoSettings();
  const campaign = await findCampaignOrNull(post.campaignId);
  const environment = resolveEnvironment(post, await getVideoEnvironment());
  const content = resolvePostContent(post);
  if (!content.character?.videoCharacterId) {
    throw new Error(`Character "${content.character?.name || 'unknown'}" has no trained video character`);
  }

  await prisma.videoPost.update({ where: { id: postId }, data: { status: 'planning', errorMessage: null } });
  const config = resolveVideoConfig({ post, campaign, settings });

  try {
    const { plan } = await planVideoPost({
      campaignId: post.campaignId,
      postId,
      title: content.title,
      summary: content.summary,
      contentText: content.contentText,
      character: content.character,
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
// 3. approvePlan — Phase 2 -> Phase 3a. Human approves the (optionally edited)
// plan, which buys the START FRAMES only. The post then parks in stills_review
// until a human has looked at those frames; approveStills is what releases the
// far more expensive video generation.
// ---------------------------------------------------------------------------
export async function approvePlan(postId, { editedPlan, directorNote } = {}) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: {
      article: { include: { category: { include: { section: true } } } },
      customCharacter: true,
      customSection: true,
    },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);
  if (!post.plan) throw new Error('Post has no draft plan to approve — run planning first.');

  const content = resolvePostContent(post);
  if (!content.character?.videoCharacterId) {
    throw new Error(`Character "${content.character?.name || 'unknown'}" has no trained video character`);
  }

  const settings = await getVideoSettings();
  const campaign = await findCampaignOrNull(post.campaignId);
  const environment = resolveEnvironment(post, await getVideoEnvironment());
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

  await prisma.videoPost.update({ where: { id: postId }, data: { status: 'shooting_stills' } });

  try {
    const { result } = await generateVideoStills({
      campaignId: post.campaignId,
      postId,
      title: content.title,
      character: content.character,
      environment,
      config,
      plan,
      directorNote: directorNote ?? post.directorNote,
      settings,
      promptLearnings,
    });

    await prisma.videoPost.update({
      where: { id: postId },
      data: {
        status: 'stills_review',
        errorMessage: result.anchorStill?.url ? null : 'The character anchor still failed to generate',
      },
    });

    return result;
  } catch (error) {
    await prisma.videoPost.update({ where: { id: postId }, data: { status: 'failed', errorMessage: error.message } });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 3a-bis. regenerateStill — a human rejected one start frame. Cheap to redo,
// and the whole point of the gate, so it stays available for as long as the
// post sits in stills_review.
// ---------------------------------------------------------------------------
export async function regenerateStill(postId, { target, order, note } = {}) {
  return regenerateVideoStill({ postId, target, order, note });
}

// ---------------------------------------------------------------------------
// 3b. approveStills — the human signed off on the frames. This is the point
// where the video budget is actually committed.
// ---------------------------------------------------------------------------
export async function approveStills(postId, { directorNote } = {}) {
  const post = await prisma.videoPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error(`Post not found: ${postId}`);

  await prisma.videoPost.update({ where: { id: postId }, data: { status: 'directing', errorMessage: null } });

  try {
    const { result } = await shootVideoPost({ postId, directorNote: directorNote ?? post.directorNote });

    const segments = await prisma.videoSegment.findMany({ where: { postId } });
    const anySucceeded = segments.some((s) => s.status === 'completed');

    await prisma.videoPost.update({
      where: { id: postId },
      data: {
        status: anySucceeded ? 'directing' : 'failed',
        narration: result.narration || post.narration,
        generatedText: result.text || post.generatedText,
        hashtags: result.hashtags || post.hashtags,
        genre: result.genre || post.genre,
        errorMessage: anySucceeded ? null : 'All segments failed to generate',
      },
    });

    return result;
  } catch (error) {
    if (error.code !== 'INVALID_REQUEST') {
      await prisma.videoPost.update({ where: { id: postId }, data: { status: 'failed', errorMessage: error.message } });
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 3b. continuePost — pick an interrupted shoot back up instead of paying to
// redo it. Use when execution died on an Anthropic-side error (credits, model
// overload): the Higgsfield jobs were already fired and billed, so this asks
// the same director session to account for them and fill only the gaps.
// ---------------------------------------------------------------------------
export async function continuePost(postId) {
  const post = await prisma.videoPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error(`Post not found: ${postId}`);

  await prisma.videoPost.update({ where: { id: postId }, data: { status: 'directing', errorMessage: null } });

  try {
    const { result } = await continueVideoPost({ postId });

    const segments = await prisma.videoSegment.findMany({ where: { postId } });
    const anySucceeded = segments.some((s) => s.status === 'completed');

    await prisma.videoPost.update({
      where: { id: postId },
      data: {
        status: anySucceeded ? 'directing' : 'failed',
        narration: result.narration || post.narration,
        generatedText: result.text || post.generatedText,
        hashtags: result.hashtags || post.hashtags,
        errorMessage: anySucceeded ? null : 'No segments could be recovered',
      },
    });

    return result;
  } catch (error) {
    // A precondition failure ("nothing to continue") isn't a shoot failure —
    // leave the post's status alone.
    if (error.code !== 'INVALID_REQUEST') {
      await prisma.videoPost.update({ where: { id: postId }, data: { status: 'failed', errorMessage: error.message } });
    }
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

  // The replaced clip is deliberately NOT deleted — it stays in the segment's
  // version history so a regeneration that comes back worse can be restored.
  return regenerateVideoSegment({ postId: segment.postId, segment, note });
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
    include: { article: true, customCharacter: true, customSection: true, segments: { orderBy: { order: 'asc' } } },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const settings = await getVideoSettings();
  const campaign = await findCampaignOrNull(post.campaignId);
  const config = resolveVideoConfig({ post, campaign, settings });
  const content = resolvePostContent(post);

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
            prompt: musicPromptFor(content.title, config),
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
    include: { article: true, customCharacter: true, customSection: true },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);
  if (!post.narrationVideoUrl) {
    throw new Error('No assembled video yet — run Re-assemble at least once before regenerating music.');
  }

  const settings = await getVideoSettings();
  const campaign = await findCampaignOrNull(post.campaignId);
  const config = resolveVideoConfig({ post, campaign, settings });
  const content = resolvePostContent(post);

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
        prompt: musicPromptFor(content.title, config, note),
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
