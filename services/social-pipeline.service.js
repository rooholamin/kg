import { prisma } from '@/lib/prisma';
import { selectApprovedPlatforms, generatePostContent } from './social-ai.service';
import { exportPost } from './social-export.service';
import { schedulePost as bufferSchedulePost, computeScheduledAt } from './buffer.service';
import { logStart, logDone, logError, logInfo } from '@/lib/social-logger';

// ---------------------------------------------------------------------------
// getSocialSettings + getSocialAiMemory helpers
// ---------------------------------------------------------------------------
async function getSocialSettings() {
  return prisma.socialSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

async function getSocialAiMemory() {
  return prisma.socialAiMemory.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

// ---------------------------------------------------------------------------
// 1. runApproval
// Calls the Managed Agent to decide which articles go to which platforms,
// then creates SocialPost rows.
// ---------------------------------------------------------------------------
export async function runApproval(campaignId) {
  const campaign = await prisma.socialCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

  await prisma.socialCampaign.update({
    where: { id: campaignId },
    data: { status: 'running' },
  });

  await logInfo(campaignId, 'pipeline_start', 'Pipeline started');

  const settings = await getSocialSettings();
  const memory = await getSocialAiMemory();

  // Fetch eligible articles for the week — must be fully published to WP
  const fetchLogId = await logStart(campaignId, 'approval_fetch', 'Fetching published articles for the week');
  const articles = await prisma.article.findMany({
    where: {
      status: 'post_publish',
      publishDate: {
        gte: campaign.weekStart,
        lte: campaign.weekEnd,
      },
      ...(campaign.editorsChoiceOnly ? { isEditorsChoice: true } : {}),
      ...(campaign.includeSections?.length
        ? {
            category: {
              section: { slug: { in: campaign.includeSections } },
            },
          }
        : {}),
    },
    include: {
      category: {
        include: { section: true },
      },
      topic: true,
    },
  });

  if (!articles.length) {
    await logError(fetchLogId, 'No eligible published articles found for this week');
    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { status: 'failed' },
    });
    throw new Error('No eligible articles found for this week');
  }

  await logDone(
    fetchLogId,
    `Found ${articles.length} article${articles.length !== 1 ? 's' : ''}`,
    { titles: articles.map((a) => a.title) },
  );

  // Enrich articles with section names for the AI
  const articlesForAI = articles.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    sectionName: a.category?.section?.name,
    categoryName: a.category?.name,
  }));

  const approvalMap = await selectApprovedPlatforms({
    articles: articlesForAI,
    campaign,
    settings,
    memory,
  });

  // Create SocialPost rows from the approval map
  const platforms = ['instagram_carousel', 'instagram_story', 'linkedin', 'twitter'];
  const postCreateData = [];

  for (const platform of platforms) {
    const articleIds = approvalMap[platform] || [];
    const total = articleIds.length;
    for (let i = 0; i < articleIds.length; i++) {
      const articleId = articleIds[i];
      const article = articles.find((a) => a.id === articleId);
      if (!article) continue;
      const scheduledAt = computeScheduledAt(platform, settings, campaign.weekStart, i, total);
      postCreateData.push({
        campaignId,
        articleId,
        platform,
        status: 'pending',
        scheduledAt,
      });
    }
  }

  if (postCreateData.length) {
    await prisma.socialPost.createMany({ data: postCreateData });
  }

  await logInfo(
    campaignId, 'approval_posts_created',
    `Created ${postCreateData.length} social post${postCreateData.length !== 1 ? 's' : ''} from approval`,
    {
      breakdown: platforms.map((p) => ({ platform: p, count: (approvalMap[p] || []).length })),
    },
  );

  return postCreateData.length;
}

// ---------------------------------------------------------------------------
// 2. runContentGeneration
// Generates AI copy + slide selection for all pending posts in a campaign.
// ---------------------------------------------------------------------------
export async function runContentGeneration(campaignId) {
  const posts = await prisma.socialPost.findMany({
    where: { campaignId, status: 'pending' },
    include: {
      article: {
        include: {
          category: { include: { section: true } },
        },
      },
    },
  });

  if (!posts.length) return 0;

  await logInfo(campaignId, 'content_start', `Starting content generation for ${posts.length} posts`);

  const settings = await getSocialSettings();

  let succeeded = 0;
  for (const post of posts) {
    // Bail if the campaign was cancelled while we were mid-loop
    const current = await prisma.socialCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (current?.status === 'cancelled') break;

    try {
      const section = post.article.category?.section;
      if (!section) throw new Error('Article has no section');

      // Mark this individual post as generating right before we start it
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: 'content_generating' },
      });

      const { result } = await generatePostContent({
        campaignId,
        postId: post.id,
        article: post.article,
        section,
        platform: post.platform,
        settings,
      });

      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: 'content_ready',
          slideIds: result.slideIds || [],
          generatedText: result.text || '',
          hashtags: result.hashtags || [],
          placeholders: {
            ...(result.placeholders || {}),
            ...(result.arc_title ? { ARC_TITLE: result.arc_title } : {}),
            ...(result.label ? { LABEL: result.label } : {}),
          },
          exportTotal: (result.slideIds || []).length,
        },
      });
      succeeded++;
    } catch (error) {
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: 'failed', errorMessage: error.message },
      });
    }
  }
  await logInfo(campaignId, 'content_done', `Content generation complete — ${succeeded}/${posts.length} succeeded`);
  return succeeded;
}

// ---------------------------------------------------------------------------
// 2b. regeneratePostContent
// Continues the existing content session for a post so the agent remembers
// what it generated before and can make targeted revisions.
// ---------------------------------------------------------------------------
export async function regeneratePostContent(postId, instruction) {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: {
      article: { include: { category: { include: { section: true } } } },
    },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const settings = await getSocialSettings();
  const section = post.article.category?.section;
  if (!section) throw new Error('Article has no section');

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: 'content_generating' },
  });

  try {
    const { result } = await generatePostContent({
      campaignId: post.campaignId,
      postId,
      article: post.article,
      section,
      platform: post.platform,
      settings,
      instruction: instruction || undefined,
    });

    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: 'content_ready',
        slideIds: result.slideIds || [],
        generatedText: result.text || '',
        hashtags: result.hashtags || [],
        placeholders: {
          ...(result.placeholders || {}),
          ...(result.arc_title ? { ARC_TITLE: result.arc_title } : {}),
          ...(result.label ? { LABEL: result.label } : {}),
        },
        exportTotal: (result.slideIds || []).length,
      },
    });

    return result;
  } catch (error) {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'failed', errorMessage: error.message },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 3. runExport
// Exports images via Playwright for a single post, then auto-schedules if
// requireReview is disabled.
// ---------------------------------------------------------------------------
export async function runExport(postId) {
  const settings = await getSocialSettings();
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });

  if (!post) throw new Error(`Post not found: ${postId}`);

  // Reset any non-pending state so a retry starts clean.
  // For previously uploaded posts, delete the old S3 files first.
  const retryStatuses = ['failed', 'exporting', 'uploaded'];
  if (retryStatuses.includes(post.status)) {
    if (post.imageUrls?.length) {
      const { deleteFromS3 } = await import('./social-export.service');
      await Promise.allSettled(post.imageUrls.map(deleteFromS3));
    }
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'content_ready', errorMessage: null, exportProgress: 0, imageUrls: [] },
    });
  }

  // Twitter posts need no image export
  if (post.platform === 'twitter') {
    await logInfo(post.campaignId, 'export_skip', 'Twitter post — no image export needed', null, postId);
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'uploaded' },
    });
    if (!settings.requireReview) {
      await schedulePost(postId);
    }
    return [];
  }

  const exportLogId = await logStart(
    post.campaignId, 'export_start',
    `Exporting ${post.platform} images via Playwright`,
    { platform: post.platform, slideCount: post.slideIds?.length },
    postId,
  );

  let imageUrls;
  try {
    imageUrls = await exportPost(postId);
    await logDone(
      exportLogId,
      `Exported and uploaded ${imageUrls.length} image${imageUrls.length !== 1 ? 's' : ''}`,
      { imageUrls },
    );
  } catch (err) {
    await logError(exportLogId, err.message);
    throw err;
  }

  if (!settings.requireReview) {
    await schedulePost(postId);
  }

  return imageUrls;
}

// ---------------------------------------------------------------------------
// 4. schedulePost
// Calls Buffer API to schedule a single post.
// ---------------------------------------------------------------------------
export async function schedulePost(postId) {
  const settings = await getSocialSettings();
  const post = await prisma.socialPost.findUnique({ where: { id: postId }, select: { campaignId: true, platform: true, scheduledAt: true } });

  const logId = await logStart(
    post?.campaignId, 'schedule_buffer',
    `Scheduling ${post?.platform} post via Buffer`,
    { scheduledAt: post?.scheduledAt },
    postId,
  );

  try {
    const result = await bufferSchedulePost({ postId, settings });
    await logDone(logId, `Scheduled — Buffer post ID: ${result?.bufferPostId || 'unknown'}`, { bufferPostId: result?.bufferPostId });
    return result;
  } catch (err) {
    await logError(logId, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 5. scheduleAllPosts
// Schedules all uploaded posts in a campaign (used by "Schedule All" button).
// ---------------------------------------------------------------------------
export async function scheduleAllPosts(campaignId) {
  const posts = await prisma.socialPost.findMany({
    where: { campaignId, status: 'uploaded' },
  });

  await logInfo(campaignId, 'schedule_all_start', `Scheduling ${posts.length} posts via Buffer`);

  const results = await Promise.allSettled(posts.map((p) => schedulePost(p.id)));

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  await logInfo(campaignId, 'schedule_all_done', `Scheduled ${succeeded}/${posts.length} posts`);

  // Check if all posts are done
  await checkAndFinalizeCampaign(campaignId);

  return succeeded;
}

// ---------------------------------------------------------------------------
// 6. runFullPipeline
// Fire-and-forget: approval → content generation → export all posts.
// Called after campaign creation; runs in background.
// ---------------------------------------------------------------------------
export async function runFullPipeline(campaignId) {
  try {
    await runApproval(campaignId);

    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { status: 'content_generating' },
    });

    await runContentGeneration(campaignId);

    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { status: 'exporting' },
    });

    // Export all content_ready posts
    const posts = await prisma.socialPost.findMany({
      where: { campaignId, status: 'content_ready' },
    });

    await Promise.allSettled(posts.map((p) => runExport(p.id)));

    await checkAndFinalizeCampaign(campaignId);
  } catch (error) {
    console.error('[social-pipeline.runFullPipeline]', error);
    await logInfo(campaignId, 'pipeline_error', `Pipeline failed: ${error.message}`);
    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { status: 'failed' },
    });
  }
}

// ---------------------------------------------------------------------------
// 7. checkAndFinalizeCampaign
// Marks campaign as done when all posts are scheduled.
// ---------------------------------------------------------------------------
export async function checkAndFinalizeCampaign(campaignId) {
  const posts = await prisma.socialPost.findMany({
    where: { campaignId },
    select: { status: true },
  });

  if (!posts.length) return;

  const allDone = posts.every((p) => p.status === 'scheduled' || p.status === 'failed');
  const anyScheduled = posts.some((p) => p.status === 'scheduled');

  if (allDone) {
    const finalStatus = anyScheduled ? 'done' : 'failed';
    await logInfo(campaignId, 'pipeline_complete', `Campaign finalized as "${finalStatus}"`);
    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { status: finalStatus },
    });
  } else {
    // Still has pending/uploading posts
    const settings = await getSocialSettings();
    if (settings.requireReview) {
      await prisma.socialCampaign.update({
        where: { id: campaignId },
        data: { status: 'reviewing' },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 8. pullAnalyticsForCampaign
// ---------------------------------------------------------------------------
export async function pullAnalyticsForCampaign(campaignId) {
  const { pullAnalytics } = await import('./buffer.service');
  const posts = await prisma.socialPost.findMany({
    where: { campaignId, status: 'scheduled', bufferPostId: { not: null } },
  });
  await Promise.allSettled(posts.map((p) => pullAnalytics(p.id)));
}
