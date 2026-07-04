import { prisma } from '@/lib/prisma';
import { selectApprovedPlatforms, generatePostContent } from './social-ai.service';
import { exportPost } from './social-export.service';
import { schedulePost as bufferSchedulePost, unschedulePost as bufferUnschedulePost, computeScheduledAt } from './buffer.service';
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
// LinkedIn clones the Instagram Carousel post for the same article — same
// slide images, same caption, same slide IDs. Helpers below find the sibling
// post and copy its generated content / exported images directly.
// ---------------------------------------------------------------------------
const COVER_VARIANT_KEYS = ['default', 'bottom-anchor', 'center-vignette', 'left-panel'];

function pickRandomCoverVariant() {
  return COVER_VARIANT_KEYS[Math.floor(Math.random() * COVER_VARIANT_KEYS.length)];
}

async function findCarouselSibling(campaignId, articleId) {
  return prisma.socialPost.findFirst({
    where: { campaignId, articleId, platform: 'instagram_carousel' },
  });
}

// ---------------------------------------------------------------------------
// Template usage stats — lets the content agent see how many times each
// slide template has already been used elsewhere in this campaign, so it can
// balance/rotate its picks instead of converging on the same few templates.
// LinkedIn shares the carousel template pool (it clones carousel posts), so
// its slideIds count toward the same tally.
// ---------------------------------------------------------------------------
const USAGE_STATS_PLATFORMS = {
  story: ['instagram_story'],
  carousel: ['instagram_carousel', 'linkedin'],
};

async function getTemplateUsageStats(campaignId, platformTemplateKey, excludePostId) {
  const platforms = USAGE_STATS_PLATFORMS[platformTemplateKey];
  if (!platforms) return {};

  const posts = await prisma.socialPost.findMany({
    where: {
      campaignId,
      platform: { in: platforms },
      ...(excludePostId ? { id: { not: excludePostId } } : {}),
    },
    select: { slideIds: true },
  });

  const stats = {};
  for (const post of posts) {
    for (const slideId of post.slideIds) {
      stats[slideId] = (stats[slideId] || 0) + 1;
    }
  }
  return stats;
}

function templateKeyForPlatform(platform) {
  if (platform === 'instagram_story') return 'story';
  if (platform === 'instagram_carousel' || platform === 'linkedin') return 'carousel';
  return null;
}

/**
 * Persists a generatePostContent() result onto a post, merging with any
 * placeholders already on the post (e.g. a user-edited COVER_VARIANT) and
 * randomly assigning a cover variant the first time a post gets a "01-cover" slide.
 */
async function saveGeneratedContent(post, result) {
  const slideIds = result.slideIds || [];
  const placeholders = {
    ...(post.placeholders || {}),
    ...(result.placeholders || {}),
    ...(result.label ? { LABEL: result.label } : {}),
  };
  if (slideIds.includes('01-cover') && !placeholders.COVER_VARIANT) {
    placeholders.COVER_VARIANT = pickRandomCoverVariant();
  }

  await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      status: 'content_ready',
      slideIds,
      generatedText: result.text || '',
      hashtags: result.hashtags || [],
      placeholders,
      slideImages: result.images || {},
      exportTotal: slideIds.length,
    },
  });
}

/**
 * If a sibling Instagram Carousel post for the same article already generated
 * content successfully, clone it onto the given LinkedIn post directly — no
 * agent call. Returns true if cloned, false if there's no usable sibling yet.
 */
async function tryCloneCarouselContent(post) {
  const sibling = await findCarouselSibling(post.campaignId, post.articleId);
  if (!sibling?.slideIds?.length) return false;

  await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      status: 'content_ready',
      slideIds: sibling.slideIds,
      generatedText: sibling.generatedText,
      hashtags: sibling.hashtags,
      placeholders: sibling.placeholders,
      slideImages: sibling.slideImages,
      exportTotal: sibling.slideIds.length,
    },
  });
  return true;
}

/**
 * If a sibling Instagram Carousel post for the same article has already been
 * exported/uploaded, clone its image URLs onto the given LinkedIn post directly
 * — no re-export, no re-upload, same CDN URLs referenced by both posts.
 */
async function tryCloneCarouselImages(post) {
  const sibling = await findCarouselSibling(post.campaignId, post.articleId);
  if (sibling?.status !== 'uploaded' || !sibling.imageUrls?.length) return null;

  await logInfo(
    post.campaignId, 'export_clone',
    'Cloning exported images from sibling Instagram Carousel post — no re-export needed',
    { sourcePostId: sibling.id },
    post.id,
  );

  await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      status: 'uploaded',
      imageUrls: sibling.imageUrls,
      exportProgress: sibling.imageUrls.length,
      exportTotal: sibling.imageUrls.length,
    },
  });
  return sibling.imageUrls;
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
      const rawScheduledAt = computeScheduledAt(platform, settings, campaign.weekStart, i, total);
      // Never schedule a social post before its article actually goes live on
      // WordPress — the week's even day-spread otherwise happily lands a post
      // a day or two ahead of an article publishing later that same week.
      const scheduledAt = article.publishDate && rawScheduledAt < article.publishDate
        ? new Date(article.publishDate.getTime() + 30 * 60 * 1000)
        : rawScheduledAt;
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

  // Process non-LinkedIn posts first so each LinkedIn post can clone its
  // sibling Instagram Carousel post's content instead of generating its own.
  const linkedinPosts = posts.filter((p) => p.platform === 'linkedin');
  const otherPosts = posts.filter((p) => p.platform !== 'linkedin');
  const orderedPosts = [...otherPosts, ...linkedinPosts];

  let succeeded = 0;
  for (const post of orderedPosts) {
    // Bail if the campaign was paused or cancelled while we were mid-loop
    const current = await prisma.socialCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (current?.status === 'cancelled' || current?.status === 'paused') break;

    try {
      const section = post.article.category?.section;
      if (!section) throw new Error('Article has no section');

      // Mark this individual post as generating right before we start it
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: 'content_generating' },
      });

      if (post.platform === 'linkedin') {
        const cloned = await tryCloneCarouselContent(post);
        if (cloned) {
          await logInfo(campaignId, 'content_clone', `Cloned content from sibling Instagram Carousel post for "${post.article.title}"`, null, post.id);
          succeeded++;
          continue;
        }
      }

      // LinkedIn has no templates/prompt of its own — a fallback generation always
      // uses the exact Instagram Carousel prompt/template menu, saved onto this post.
      const generationPlatform = post.platform === 'linkedin' ? 'instagram_carousel' : post.platform;
      const usageStats = await getTemplateUsageStats(campaignId, templateKeyForPlatform(generationPlatform));
      const { result } = await generatePostContent({
        campaignId,
        postId: post.id,
        article: post.article,
        section,
        platform: generationPlatform,
        settings,
        usageStats,
      });

      await saveGeneratedContent(post, result);
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
    // A manual regenerate on a LinkedIn post intentionally lets it diverge from
    // its sibling — same Instagram Carousel prompt/template menu, but its own result.
    const generationPlatform = post.platform === 'linkedin' ? 'instagram_carousel' : post.platform;
    const usageStats = await getTemplateUsageStats(post.campaignId, templateKeyForPlatform(generationPlatform), postId);
    const { result } = await generatePostContent({
      campaignId: post.campaignId,
      postId,
      article: post.article,
      section,
      platform: generationPlatform,
      settings,
      instruction: instruction || undefined,
      usageStats,
    });

    await saveGeneratedContent(post, result);

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

  // LinkedIn: reuse the sibling Instagram Carousel post's already-exported images
  // when available, instead of exporting/uploading a second identical set.
  if (post.platform === 'linkedin') {
    const clonedUrls = await tryCloneCarouselImages(post);
    if (clonedUrls) {
      if (!settings.requireReview) {
        await schedulePost(postId);
      }
      return clonedUrls;
    }
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
    // bufferSchedulePost resolves to the plain Buffer post ID string, not an object.
    const bufferPostId = await bufferSchedulePost({ postId, settings });
    await logDone(logId, `Scheduled — Buffer post ID: ${bufferPostId || 'unknown'}`, { bufferPostId });
    return bufferPostId;
  } catch (err) {
    await logError(logId, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 4b. unschedulePost
// Removes a post from Buffer and reverts it to "uploaded" so it can be
// edited/regenerated and re-sent.
// ---------------------------------------------------------------------------
export async function unschedulePost(postId) {
  const post = await prisma.socialPost.findUnique({ where: { id: postId }, select: { campaignId: true, platform: true, bufferPostId: true } });

  const logId = await logStart(
    post?.campaignId, 'unschedule_buffer',
    `Removing ${post?.platform} post from Buffer`,
    { bufferPostId: post?.bufferPostId },
    postId,
  );

  try {
    await bufferUnschedulePost(postId);
    await logDone(logId, 'Removed from Buffer — post reverted to "uploaded"');
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

    // Export all content_ready posts — non-LinkedIn first, so each LinkedIn
    // post can clone its sibling Instagram Carousel post's exported images.
    const posts = await prisma.socialPost.findMany({
      where: { campaignId, status: 'content_ready' },
    });
    const linkedinPosts = posts.filter((p) => p.platform === 'linkedin');
    const otherPosts = posts.filter((p) => p.platform !== 'linkedin');

    await Promise.allSettled(otherPosts.map((p) => runExport(p.id)));
    await Promise.allSettled(linkedinPosts.map((p) => runExport(p.id)));

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
// 8. resumePipeline
// Recovers a paused, cancelled, or interrupted campaign by:
//   1. Resetting stuck mid-flight posts back to their previous stable state
//   2. Re-running content generation for any remaining pending posts
//   3. Re-running export for any content_ready posts
// ---------------------------------------------------------------------------
export async function resumePipeline(campaignId) {
  await logInfo(campaignId, 'pipeline_resume', 'Pipeline resumed by user');

  // Reset any posts that were mid-flight when the pipeline was interrupted
  await prisma.socialPost.updateMany({
    where: { campaignId, status: 'content_generating' },
    data: { status: 'pending', errorMessage: null },
  });
  await prisma.socialPost.updateMany({
    where: { campaignId, status: 'exporting' },
    data: { status: 'content_ready', exportProgress: 0, imageUrls: [], errorMessage: null },
  });

  const pendingCount = await prisma.socialPost.count({ where: { campaignId, status: 'pending' } });
  const contentReadyCount = await prisma.socialPost.count({ where: { campaignId, status: 'content_ready' } });

  // Resume content generation if there are pending posts
  if (pendingCount > 0) {
    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { status: 'content_generating' },
    });
    await runContentGeneration(campaignId);
  }

  // Export all content-ready posts — non-LinkedIn first, so each LinkedIn
  // post can clone its sibling Instagram Carousel post's exported images.
  if (pendingCount > 0 || contentReadyCount > 0) {
    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { status: 'exporting' },
    });
    const posts = await prisma.socialPost.findMany({
      where: { campaignId, status: 'content_ready' },
    });
    const linkedinPosts = posts.filter((p) => p.platform === 'linkedin');
    const otherPosts = posts.filter((p) => p.platform !== 'linkedin');

    await Promise.allSettled(otherPosts.map((p) => runExport(p.id)));
    await Promise.allSettled(linkedinPosts.map((p) => runExport(p.id)));
  }

  await checkAndFinalizeCampaign(campaignId);
}

// ---------------------------------------------------------------------------
// 9. pullAnalyticsForCampaign
// ---------------------------------------------------------------------------
export async function pullAnalyticsForCampaign(campaignId) {
  const { pullAnalytics } = await import('./buffer.service');
  const posts = await prisma.socialPost.findMany({
    where: { campaignId, status: 'scheduled', bufferPostId: { not: null } },
  });
  await Promise.allSettled(posts.map((p) => pullAnalytics(p.id)));
}
