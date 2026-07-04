import { prisma } from '@/lib/prisma';
import { getArticlePermalink } from '@/services/wordpress.service';
import { logInfo } from '@/lib/social-logger';
import { buildLinkedInCarouselDocument } from '@/services/social-export.service';

const BUFFER_GRAPHQL = 'https://api.buffer.com';

// ---------------------------------------------------------------------------
// Core GraphQL helper
// ---------------------------------------------------------------------------

function getToken() {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) throw new Error('BUFFER_ACCESS_TOKEN is not set');
  return token;
}

// Returns { data, raw, status } — callers get the raw response text so it can
// be persisted verbatim to SocialCampaignLog for debugging (Buffer's typed
// errors are often terse, e.g. "Invalid post: ", so the full body — including
// the GraphQL `errors` array/extensions our typed query doesn't select — is
// sometimes the only place with extra context).
async function bufferQuery(query, variables = {}) {
  const res = await fetch(BUFFER_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = new Error(`Buffer API HTTP ${res.status}: ${text}`);
    err.bufferRaw = text;
    err.bufferStatus = res.status;
    throw err;
  }

  if (json?.errors?.length) {
    const err = new Error(`Buffer GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
    err.bufferRaw = text;
    err.bufferStatus = res.status;
    throw err;
  }

  return { data: json?.data, raw: text, status: res.status };
}

// ---------------------------------------------------------------------------
// Channel ID resolution (DB only — no env var fallback)
// ---------------------------------------------------------------------------

function getChannelId(platform, settings) {
  const map = {
    instagram_carousel: settings?.instagramChannelId,
    instagram_story:    settings?.instagramChannelId,
    linkedin:           settings?.linkedinChannelId,
    twitter:            settings?.twitterChannelId,
  };

  const channelId = map[platform];
  if (!channelId) {
    throw new Error(
      `No Buffer channel ID configured for platform "${platform}". ` +
      `Go to Social → Settings and fill in the channel IDs.`,
    );
  }

  return channelId;
}

// ---------------------------------------------------------------------------
// Article CTA — appended to the caption only for platforms with no native
// visual context for the article (Twitter, LinkedIn). Instagram Carousel and
// Instagram Story captions stay CTA-free per the content agent's tone rules.
// ---------------------------------------------------------------------------

const CTA_PREFIX = {
  linkedin: 'Read the full article on KG Hub:',
  twitter: 'Read more:',
};

async function appendArticleCta(caption, platform, article, section) {
  const prefix = CTA_PREFIX[platform];
  if (!prefix) return caption;

  const permalink = await getArticlePermalink(article, section);
  if (!permalink) return caption;

  const ctaLine = `${prefix} ${permalink}`;

  if (platform === 'twitter') {
    const maxLen = 280;
    const available = maxLen - ctaLine.length - 2; // 2 chars for the blank-line separator
    let trimmed = caption;
    if (trimmed.length > available) {
      trimmed = available > 1 ? `${trimmed.slice(0, available - 1).trimEnd()}…` : '';
    }
    return trimmed ? `${trimmed}\n\n${ctaLine}` : ctaLine;
  }

  return `${caption}\n\n${ctaLine}`;
}

// ---------------------------------------------------------------------------
// schedulePost
// ---------------------------------------------------------------------------

const CREATE_POST_MUTATION = /* GraphQL */ `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess {
        post {
          id
          dueAt
        }
      }
      ... on MutationError {
        message
      }
    }
  }
`;

export async function schedulePost({ postId, settings }) {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: {
      article: {
        include: {
          category: {
            include: { section: true },
          },
        },
      },
    },
  });

  if (!post) throw new Error(`SocialPost not found: ${postId}`);

  // Guard against a social post going out before its article is actually
  // live on WordPress (e.g. a manually-edited scheduledAt, or a post created
  // before this check existed) — Buffer would otherwise happily publish a
  // caption/CTA linking to content that doesn't exist yet.
  if (post.scheduledAt && post.article?.publishDate && new Date(post.scheduledAt) < new Date(post.article.publishDate)) {
    throw new Error(
      `Refusing to schedule: post is set for ${new Date(post.scheduledAt).toISOString()}, ` +
      `which is before the article publishes on ${new Date(post.article.publishDate).toISOString()}. ` +
      `Move the scheduled time to after the article's publish date.`,
    );
  }

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: 'scheduling' },
  });

  try {
    const channelId = getChannelId(post.platform, settings);
    const section = post.article?.category?.section;

    const caption =
      post.platform === 'instagram_story' ? '' : (post.generatedText || '');

    // Fill any remaining {{PLACEHOLDER}} tokens from post.placeholders before sending
    let filledCaption = caption.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
      return post.placeholders?.[key] ?? '';
    });

    // Twitter and LinkedIn have no visual "read more" affordance like the
    // Instagram templates do, so append a link to the full article here
    // rather than asking the content agent to write one into the caption.
    filledCaption = await appendArticleCta(filledCaption, post.platform, post.article, section);

    // Instagram Stories can't be auto-published via the API for all account
    // types, so use Buffer's notification (reminder) publishing instead —
    // Buffer pings the mobile app and the user finishes posting manually.
    const input = {
      channelId,
      text: filledCaption,
      schedulingType: post.platform === 'instagram_story' ? 'notification' : 'automatic',
      assets: [],
    };

    // Scheduling mode
    if (post.scheduledAt) {
      input.mode = 'customScheduled';
      input.dueAt = new Date(post.scheduledAt).toISOString();
    } else {
      input.mode = 'addToQueue';
    }

    // Media assets (not for Twitter)
    if (post.platform === 'linkedin' && post.imageUrls?.length > 1) {
      // LinkedIn removed native image carousels in Dec 2023 — multiple `image`
      // assets just render as a static grid. A PDF `document` asset is the
      // only format LinkedIn treats as a swipeable carousel.
      const doc = await buildLinkedInCarouselDocument(post, post.article);
      input.assets = [{ document: doc }];
    } else if (post.platform !== 'twitter' && post.imageUrls?.length) {
      input.assets = post.imageUrls.map((url) => ({ image: { url } }));
    }

    // Instagram-specific metadata
    if (post.platform === 'instagram_carousel' || post.platform === 'instagram_story') {
      const igType = post.platform === 'instagram_story' ? 'story' : 'post';
      // shouldShareToFeed: a "post" (carousel) IS the feed by definition, so this
      // must be true — Buffer's own docs example is `{ type: POST, shouldShareToFeed: true }`.
      // A "story" correctly stays false since stories don't appear in the main feed.
      input.metadata = {
        instagram: {
          type: igType,
          shouldShareToFeed: igType === 'post',
        },
      };

      if (post.platform === 'instagram_story') {
        const permalink = await getArticlePermalink(post.article, section);
        if (permalink) {
          input.metadata.instagram.link = permalink;
        }
      }
    }

    let queryResult;
    try {
      queryResult = await bufferQuery(CREATE_POST_MUTATION, { input });
    } catch (err) {
      // HTTP-level or top-level GraphQL error — log the full exchange before
      // re-throwing so the raw body is visible in the campaign log.
      await logInfo(
        post.campaignId, 'buffer_raw_response',
        `Buffer request failed for ${post.platform} post`,
        { input, raw: err.bufferRaw, status: err.bufferStatus },
        postId,
      );
      throw err;
    }

    const { data, raw, status } = queryResult;
    const result = data?.createPost;

    // Always persist the exact input we sent and the exact body Buffer
    // returned, success or failure — this is the "full log from Buffer".
    await logInfo(
      post.campaignId, 'buffer_raw_response',
      result?.message
        ? `Buffer rejected ${post.platform} post`
        : `Buffer accepted ${post.platform} post`,
      { input, raw, status },
      postId,
    );

    if (result?.message) {
      throw new Error(`Buffer rejected post: ${result.message}`);
    }

    const bufferPostId = result?.post?.id;
    const dueAt = result?.post?.dueAt;

    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: 'scheduled',
        bufferPostId,
        scheduledAt: dueAt ? new Date(dueAt) : post.scheduledAt,
      },
    });

    return bufferPostId;
  } catch (error) {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'failed', errorMessage: error.message },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// unschedulePost — removes a post from Buffer (e.g. it was sent by mistake,
// or with bad content) and reverts the SocialPost back to "uploaded" so it
// can be edited/regenerated and re-sent.
// ---------------------------------------------------------------------------

const DELETE_POST_MUTATION = /* GraphQL */ `
  mutation DeletePost($input: DeletePostInput!) {
    deletePost(input: $input) {
      ... on DeletePostSuccess {
        id
      }
      ... on MutationError {
        message
      }
    }
  }
`;

export async function unschedulePost(postId) {
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error(`SocialPost not found: ${postId}`);
  if (!post.bufferPostId) throw new Error('Post has no Buffer post ID — nothing to remove');

  const input = { id: post.bufferPostId };

  let queryResult;
  try {
    queryResult = await bufferQuery(DELETE_POST_MUTATION, { input });
  } catch (err) {
    await logInfo(
      post.campaignId, 'buffer_raw_response',
      `Buffer delete request failed for ${post.platform} post`,
      { input, raw: err.bufferRaw, status: err.bufferStatus },
      postId,
    );
    throw err;
  }

  const { data, raw, status } = queryResult;
  const result = data?.deletePost;

  await logInfo(
    post.campaignId, 'buffer_raw_response',
    result?.message ? `Buffer rejected delete for ${post.platform} post` : `Removed ${post.platform} post from Buffer`,
    { input, raw, status },
    postId,
  );

  if (result?.message) {
    throw new Error(`Buffer rejected delete: ${result.message}`);
  }

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: 'uploaded', bufferPostId: null, errorMessage: null },
  });

  return true;
}

// ---------------------------------------------------------------------------
// pullAnalytics
// ---------------------------------------------------------------------------

// Note: Buffer uses custom scalars (PostId, etc.) — embed IDs directly in
// queries rather than using typed variables to avoid scalar type mismatches.
function buildGetPostMetricsQuery(bufferPostId) {
  return /* GraphQL */ `
    query {
      post(input: { id: "${bufferPostId}" }) {
        metrics {
          type
          name
          value
          unit
        }
        metricsUpdatedAt
      }
    }
  `;
}

export async function pullAnalytics(postId) {
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post?.bufferPostId) return null;

  try {
    const { data } = await bufferQuery(buildGetPostMetricsQuery(post.bufferPostId));
    const metrics = data?.post?.metrics ?? [];

    const find = (type) => metrics.find((m) => m.type === type)?.value ?? 0;

    const analyticsData = {
      impressions: find('impressions'),
      reach:       find('reach'),
      likes:       find('reactions'),
      comments:    find('comments'),
      shares:      find('reposts'),
      clicks:      0,
      pulledAt:    new Date().toISOString(),
    };

    await prisma.socialPost.update({
      where: { id: postId },
      data: { analyticsData },
    });

    return analyticsData;
  } catch (error) {
    console.error('[buffer.pullAnalytics]', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// computeScheduledAt — distribute posts evenly across the posting window
// (unchanged from previous version)
// ---------------------------------------------------------------------------

export function computeScheduledAt(platform, settings, weekStart, index = 0, total = 1) {
  const cfgMap = {
    instagram_carousel: {
      daysMask:    settings?.instagramCarouselDays    ?? 28,
      windowStart: settings?.instagramCarouselWindowStart ?? '10:00',
      windowEnd:   settings?.instagramCarouselWindowEnd   ?? '10:00',
    },
    instagram_story: {
      daysMask:    settings?.instagramStoryDays    ?? 62,
      windowStart: settings?.instagramStoryWindowStart ?? '08:00',
      windowEnd:   settings?.instagramStoryWindowEnd   ?? '20:00',
    },
    linkedin: {
      daysMask:    settings?.linkedinDays    ?? 20,
      windowStart: settings?.linkedinWindowStart ?? '09:00',
      windowEnd:   settings?.linkedinWindowEnd   ?? '09:00',
    },
    twitter: {
      daysMask:    settings?.twitterDays    ?? 42,
      windowStart: settings?.twitterWindowStart ?? '10:00',
      windowEnd:   settings?.twitterWindowEnd   ?? '10:00',
    },
  };

  const cfg = cfgMap[platform] ?? cfgMap.instagram_carousel;
  const { daysMask, windowStart, windowEnd } = cfg;

  const [startH, startM] = windowStart.split(':').map(Number);
  const [endH, endM]     = windowEnd.split(':').map(Number);
  const windowStartMin   = startH * 60 + startM;
  const windowEndMin     = endH   * 60 + endM;

  const tzOffsetHours = settings?.timezoneOffset ?? 0;

  const base = new Date(weekStart || Date.now());
  const validDays = [];
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + offset);
    if (daysMask & (1 << d.getUTCDay())) {
      validDays.push(new Date(d));
    }
  }

  if (!validDays.length) {
    const fallback = new Date(base);
    fallback.setUTCDate(fallback.getUTCDate() + 1);
    fallback.setUTCHours(startH - tzOffsetHours, startM, 0, 0);
    return fallback;
  }

  const postsPerDay = Math.ceil(total / validDays.length);
  const dayIndex    = Math.floor(index / postsPerDay);
  const slotIndex   = index % postsPerDay;
  const chosenDay   = validDays[dayIndex % validDays.length];

  let minuteOffset = 0;
  if (postsPerDay > 1 && windowEndMin > windowStartMin) {
    minuteOffset = slotIndex * ((windowEndMin - windowStartMin) / (postsPerDay - 1));
  }

  const totalMinutes = windowStartMin + minuteOffset;
  const localHour    = Math.floor(totalMinutes / 60);
  const localMinute  = Math.round(totalMinutes % 60);
  const utcHour      = localHour - tzOffsetHours;

  chosenDay.setUTCHours(utcHour, localMinute, 0, 0);
  return chosenDay;
}
