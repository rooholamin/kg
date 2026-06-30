import { prisma } from '@/lib/prisma';
import { selectApprovedPlatforms, generatePostContent } from './social-ai.service';
import { exportPost } from './social-export.service';
import { schedulePost as bufferSchedulePost, computeScheduledAt } from './buffer.service';

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

  const settings = await getSocialSettings();
  const memory = await getSocialAiMemory();

  // Fetch eligible articles for the week
  const articles = await prisma.article.findMany({
    where: {
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
    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { status: 'failed' },
    });
    throw new Error('No eligible articles found for this week');
  }

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
    for (const articleId of articleIds) {
      const article = articles.find((a) => a.id === articleId);
      if (!article) continue;
      const scheduledAt = computeScheduledAt(platform, settings, campaign.weekStart);
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

  // Mark all as generating
  await prisma.socialPost.updateMany({
    where: { id: { in: posts.map((p) => p.id) } },
    data: { status: 'content_generating' },
  });

  const settings = await getSocialSettings();

  const results = await Promise.allSettled(
    posts.map(async (post) => {
      try {
        const section = post.article.category?.section;
        if (!section) throw new Error('Article has no section');

        const { result } = await generatePostContent({
          article: post.article,
          section,
          platform: post.platform,
          settings,
        });

        // Session ID is saved inside generatePostContent; update content fields here
        await prisma.socialPost.update({
          where: { id: post.id },
          data: {
            status: 'content_ready',
            slideIds: result.slideIds || [],
            generatedText: result.text || '',
            hashtags: result.hashtags || [],
            placeholders: result.placeholders || {},
            exportTotal: (result.slideIds || []).length,
          },
        });
      } catch (error) {
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: 'failed', errorMessage: error.message },
        });
      }
    }),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
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
        placeholders: result.placeholders || {},
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

  // Twitter posts need no image export
  if (post.platform === 'twitter') {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'uploaded' },
    });
    if (!settings.requireReview) {
      await schedulePost(postId);
    }
    return [];
  }

  const imageUrls = await exportPost(postId);

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
  return bufferSchedulePost({ postId, settings });
}

// ---------------------------------------------------------------------------
// 5. scheduleAllPosts
// Schedules all uploaded posts in a campaign (used by "Schedule All" button).
// ---------------------------------------------------------------------------
export async function scheduleAllPosts(campaignId) {
  const posts = await prisma.socialPost.findMany({
    where: { campaignId, status: 'uploaded' },
  });

  const results = await Promise.allSettled(posts.map((p) => schedulePost(p.id)));

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;

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
    await runContentGeneration(campaignId);

    // Export all content_ready posts
    const posts = await prisma.socialPost.findMany({
      where: { campaignId, status: 'content_ready' },
    });

    await Promise.allSettled(posts.map((p) => runExport(p.id)));

    await checkAndFinalizeCampaign(campaignId);
  } catch (error) {
    console.error('[social-pipeline.runFullPipeline]', error);
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
    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { status: anyScheduled ? 'done' : 'failed' },
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
