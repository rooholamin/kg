import { prisma } from '@/lib/prisma';
import { selectVideoArticles, directVideoPost } from './video-ai.service';
import { deleteFromS3 } from './social-export.service';
import { scheduleVideoPost as bufferScheduleVideoPost, unscheduleVideoPost as bufferUnscheduleVideoPost, pullVideoAnalytics } from './buffer.service';
import { uploadUrlToSpaces } from './video-export.service';
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

/**
 * Persists a directVideoPost() result onto a post.
 */
async function saveDirectedContent(post, result) {
  const hasVideo = !!result.videoUrl;
  await prisma.videoPost.update({
    where: { id: post.id },
    data: {
      status: hasVideo ? 'content_ready' : 'failed',
      shotList: result.shotList || [],
      generatedText: result.text || '',
      hashtags: result.hashtags || [],
      stillAssetUrl: result.stillAssetUrl || null,
      videoUrl: result.videoUrl || null,
      duration: result.duration || null,
      aspectRatio: result.aspectRatio || null,
      genre: result.genre || null,
      errorMessage: hasVideo ? null : (result.errorMessage || 'Director agent did not produce a video'),
    },
  });
}

// ---------------------------------------------------------------------------
// 1. runVideoApproval
// Mirrors runApproval in social-pipeline.service.js — calls the Video
// Approval Agent to decide which articles get a video this cycle, then
// creates VideoPost rows.
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

  // Only articles whose section already has a trained video character can
  // actually be directed — surfacing this here (rather than failing later,
  // one post at a time) keeps the approval agent from picking articles that
  // can never be produced.
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
// 2. runVideoDirecting
// Mirrors runContentGeneration — directs every pending post in a campaign.
// ---------------------------------------------------------------------------
export async function runVideoDirecting(campaignId) {
  const posts = await prisma.videoPost.findMany({
    where: { campaignId, status: 'pending' },
    include: { article: { include: { category: { include: { section: true } } } } },
  });

  if (!posts.length) return 0;

  await logInfo(campaignId, 'directing_start', `Starting directing for ${posts.length} post${posts.length !== 1 ? 's' : ''}`);

  const settings = await getVideoSettings();
  const environment = await getVideoEnvironment();
  const promptLearnings = await getRecentPromptLearnings();

  let succeeded = 0;
  for (const post of posts) {
    const current = await prisma.videoCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (current?.status === 'cancelled' || current?.status === 'paused') break;

    try {
      const section = post.article.category?.section;
      if (!section?.videoCharacterId) throw new Error('Article\'s section has no trained video character');

      await prisma.videoPost.update({ where: { id: post.id }, data: { status: 'directing' } });

      const { result } = await directVideoPost({
        campaignId,
        postId: post.id,
        article: post.article,
        section,
        environment,
        settings,
        promptLearnings,
      });

      await saveDirectedContent(post, result);
      if (result.videoUrl) succeeded++;
    } catch (error) {
      await prisma.videoPost.update({
        where: { id: post.id },
        data: { status: 'failed', errorMessage: error.message },
      });
    }
  }

  await logInfo(campaignId, 'directing_done', `Directing complete — ${succeeded}/${posts.length} succeeded`);
  return succeeded;
}

// ---------------------------------------------------------------------------
// 2b. regenerateVideoPost
// Continues the existing director session so the agent remembers what it
// directed before and can make targeted revisions.
// ---------------------------------------------------------------------------
export async function regenerateVideoPost(postId, directorNote) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: { article: { include: { category: { include: { section: true } } } } },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const settings = await getVideoSettings();
  const environment = await getVideoEnvironment();
  const promptLearnings = await getRecentPromptLearnings();
  const section = post.article.category?.section;
  if (!section?.videoCharacterId) throw new Error('Article\'s section has no trained video character');

  // Clean up previously exported assets before regenerating — same reasoning
  // as regeneratePostContent in social-pipeline.service.js: stale assets tied
  // to the old script shouldn't linger once a new one is generated.
  const staleUrls = [post.stillAssetUrl, post.videoUrl].filter(Boolean);
  if (staleUrls.length) {
    await Promise.allSettled(staleUrls.map(deleteFromS3));
  }

  await prisma.videoPost.update({
    where: { id: postId },
    data: { status: 'directing', errorMessage: null, stillAssetUrl: null, videoUrl: null },
  });

  try {
    const { result } = await directVideoPost({
      campaignId: post.campaignId,
      postId,
      article: post.article,
      section,
      environment,
      directorNote: directorNote || post.directorNote || undefined,
      settings,
      promptLearnings,
    });

    await prisma.videoPost.update({ where: { id: postId }, data: { directorNote: directorNote || post.directorNote || null } });
    await saveDirectedContent(post, result);
    return result;
  } catch (error) {
    await prisma.videoPost.update({ where: { id: postId }, data: { status: 'failed', errorMessage: error.message } });
    throw error;
  }
}

export async function regenerateAllContent(campaignId, directorNote) {
  const posts = await prisma.videoPost.findMany({
    where: { campaignId, status: { notIn: ['directing', 'scheduled'] } },
  });
  if (!posts.length) return { count: 0, succeeded: 0 };

  await logInfo(campaignId, 'regenerate_all_start', `Regenerating ${posts.length} post${posts.length !== 1 ? 's' : ''}`);

  let succeeded = 0;
  for (const post of posts) {
    try {
      await regenerateVideoPost(post.id, directorNote);
      succeeded++;
    } catch (error) {
      console.error(`[regenerateAllContent] post ${post.id} failed:`, error.message);
    }
  }

  await logInfo(campaignId, 'regenerate_all_done', `Regenerated ${succeeded}/${posts.length} post${posts.length !== 1 ? 's' : ''}`);
  return { count: posts.length, succeeded };
}

// ---------------------------------------------------------------------------
// 3. runExport
// Downloads the Higgsfield-hosted still/video and re-uploads to DigitalOcean
// Spaces (same CDN every other asset in the app lives on), then auto-
// schedules if requireReview is disabled.
// ---------------------------------------------------------------------------
export async function runExport(postId) {
  const settings = await getVideoSettings();
  const post = await prisma.videoPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error(`Post not found: ${postId}`);

  if (!post.videoUrl) {
    throw new Error('Post has no directed video yet — run/regenerate directing first.');
  }

  const retryStatuses = ['failed', 'exporting', 'uploaded'];
  if (retryStatuses.includes(post.status)) {
    await prisma.videoPost.update({ where: { id: postId }, data: { status: 'content_ready', errorMessage: null } });
  }

  const exportLogId = await logStart(post.campaignId, 'export_start', 'Uploading directed still + video to Spaces', null, postId);

  try {
    const [stillUrl, videoUrl] = await Promise.all([
      post.stillAssetUrl ? uploadUrlToSpaces(post.stillAssetUrl, `video/stills/${postId}.jpg`, 'image/jpeg') : Promise.resolve(null),
      uploadUrlToSpaces(post.videoUrl, `video/clips/${postId}.mp4`, 'video/mp4'),
    ]);

    await prisma.videoPost.update({
      where: { id: postId },
      data: {
        status: 'uploaded',
        stillAssetUrl: stillUrl || post.stillAssetUrl,
        videoUrl: videoUrl,
        platforms: post.platforms?.length ? post.platforms : settings.defaultPlatforms,
      },
    });

    await logDone(exportLogId, 'Uploaded still + video to Spaces', { stillUrl, videoUrl });
  } catch (err) {
    await logError(exportLogId, err.message);
    await prisma.videoPost.update({ where: { id: postId }, data: { status: 'failed', errorMessage: err.message } });
    throw err;
  }

  if (!settings.requireReview) {
    await schedulePost(postId);
  }
}

// ---------------------------------------------------------------------------
// 4. schedulePost / unschedulePost
// ---------------------------------------------------------------------------
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
// 5. runFullPipeline — fire-and-forget: approval → directing → export all.
// ---------------------------------------------------------------------------
export async function runFullPipeline(campaignId) {
  try {
    await runVideoApproval(campaignId);

    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'directing' } });
    await runVideoDirecting(campaignId);

    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'exporting' } });
    const posts = await prisma.videoPost.findMany({ where: { campaignId, status: 'content_ready' } });
    await Promise.allSettled(posts.map((p) => runExport(p.id)));

    await checkAndFinalizeCampaign(campaignId);
  } catch (error) {
    console.error('[video-pipeline.runFullPipeline]', error);
    await logInfo(campaignId, 'pipeline_error', `Pipeline failed: ${error.message}`);
    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'failed' } });
  }
}

// ---------------------------------------------------------------------------
// 6. checkAndFinalizeCampaign
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
// 7. resumePipeline
// ---------------------------------------------------------------------------
export async function resumePipeline(campaignId) {
  await logInfo(campaignId, 'pipeline_resume', 'Pipeline resumed by user');

  await prisma.videoPost.updateMany({
    where: { campaignId, status: 'directing' },
    data: { status: 'pending', errorMessage: null },
  });
  await prisma.videoPost.updateMany({
    where: { campaignId, status: 'exporting' },
    data: { status: 'content_ready', errorMessage: null },
  });

  const pendingCount = await prisma.videoPost.count({ where: { campaignId, status: 'pending' } });
  const contentReadyCount = await prisma.videoPost.count({ where: { campaignId, status: 'content_ready' } });

  if (pendingCount > 0) {
    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'directing' } });
    await runVideoDirecting(campaignId);
  }

  if (pendingCount > 0 || contentReadyCount > 0) {
    await prisma.videoCampaign.update({ where: { id: campaignId }, data: { status: 'exporting' } });
    const posts = await prisma.videoPost.findMany({ where: { campaignId, status: 'content_ready' } });
    await Promise.allSettled(posts.map((p) => runExport(p.id)));
  }

  await checkAndFinalizeCampaign(campaignId);
}

// ---------------------------------------------------------------------------
// 8. pullAnalyticsForCampaign
// ---------------------------------------------------------------------------
export async function pullAnalyticsForCampaign(campaignId) {
  const posts = await prisma.videoPost.findMany({
    where: { campaignId, status: 'scheduled', bufferPostIds: { not: null } },
  });
  await Promise.allSettled(posts.map((p) => pullVideoAnalytics(p.id)));
}
