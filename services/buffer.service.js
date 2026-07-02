import { prisma } from '@/lib/prisma';
import { getArticlePermalink } from '@/services/wordpress.service';

const BUFFER_GRAPHQL = 'https://api.buffer.com';

// ---------------------------------------------------------------------------
// Core GraphQL helper
// ---------------------------------------------------------------------------

function getToken() {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) throw new Error('BUFFER_ACCESS_TOKEN is not set');
  return token;
}

async function bufferQuery(query, variables = {}) {
  const res = await fetch(BUFFER_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Buffer API HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(`Buffer GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
  }

  return json.data;
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

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: 'scheduling' },
  });

  try {
    const channelId = getChannelId(post.platform, settings);

    const caption =
      post.platform === 'instagram_story' ? '' : (post.generatedText || '');

    // Reject if caption still contains unfilled {{PLACEHOLDER}} tokens
    const unfilledTokens = caption.match(/\{\{[^}]+\}\}/g);
    if (unfilledTokens) {
      throw new Error(
        `Caption contains unfilled placeholders: ${[...new Set(unfilledTokens)].join(', ')}. Edit the post before sending to Buffer.`,
      );
    }

    const input = {
      channelId,
      text: caption,
      schedulingType: 'automatic',
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
    if (post.platform !== 'twitter' && post.imageUrls?.length) {
      input.assets = post.imageUrls.map((url) => ({ image: { url } }));
    }

    // Instagram-specific metadata
    if (post.platform === 'instagram_carousel' || post.platform === 'instagram_story') {
      const igType = post.platform === 'instagram_story' ? 'story' : 'post';
      input.metadata = {
        instagram: {
          type: igType,
          shouldShareToFeed: false,
        },
      };

      if (post.platform === 'instagram_story') {
        const section = post.article?.category?.section;
        const permalink = await getArticlePermalink(post.article, section);
        if (permalink) {
          input.metadata.instagram.link = permalink;
        }
      }
    }

    const data = await bufferQuery(CREATE_POST_MUTATION, { input });

    const result = data?.createPost;
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
    const data = await bufferQuery(buildGetPostMetricsQuery(post.bufferPostId));
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
