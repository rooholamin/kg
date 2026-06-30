import { prisma } from '@/lib/prisma';

const BUFFER_API = 'https://api.bufferapp.com/1';

function getToken() {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) throw new Error('BUFFER_ACCESS_TOKEN is not set');
  return token;
}

// ---------------------------------------------------------------------------
// Profile ID resolution
// ---------------------------------------------------------------------------
const PROFILE_ENV_MAP = {
  instagram_carousel: 'BUFFER_INSTAGRAM_CAROUSEL_PROFILE_ID',
  instagram_story: 'BUFFER_INSTAGRAM_STORY_PROFILE_ID',
  linkedin: 'BUFFER_LINKEDIN_PROFILE_ID',
  twitter: 'BUFFER_TWITTER_PROFILE_ID',
};

function getProfileId(platform, settings) {
  // Check settings first (from DB), then fall back to env vars
  const settingsMap = {
    instagram_carousel: settings?.instagramCarouselProfileId,
    instagram_story: settings?.instagramStoryProfileId,
    linkedin: settings?.linkedinProfileId,
    twitter: settings?.twitterProfileId,
  };
  const fromSettings = settingsMap[platform];
  if (fromSettings) return fromSettings;

  const envVar = PROFILE_ENV_MAP[platform];
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;

  throw new Error(`No Buffer profile ID configured for platform: ${platform}`);
}

// ---------------------------------------------------------------------------
// schedulePost
// ---------------------------------------------------------------------------
export async function schedulePost({ postId, settings }) {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: { article: true },
  });

  if (!post) throw new Error(`SocialPost not found: ${postId}`);

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: 'scheduling' },
  });

  try {
    const profileId = getProfileId(post.platform, settings);
    const scheduledAt = post.scheduledAt
      ? Math.floor(new Date(post.scheduledAt).getTime() / 1000)
      : null;

    // Stories are image-only; other platforms use generatedText as caption
    const caption = post.platform === 'instagram_story' ? '' : (post.generatedText || '');

    const body = new URLSearchParams({
      access_token: getToken(),
      profile_ids: profileId,
      text: caption,
    });

    if (scheduledAt) {
      body.append('scheduled_at', String(scheduledAt));
    }

    // Attach media for non-Twitter platforms
    if (post.platform !== 'twitter' && post.imageUrls?.length) {
      post.imageUrls.forEach((url, idx) => {
        body.append(`media[photo]`, url);
        // For carousel: Buffer accepts multiple photos as an album
        if (idx > 0 && post.platform === 'instagram_carousel') {
          body.append(`media[photo_${idx}]`, url);
        }
      });
    }

    const res = await fetch(`${BUFFER_API}/updates/create.json`, {
      method: 'POST',
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Buffer API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const bufferPostId = data.updates?.[0]?.id || data.update?.id;

    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: 'scheduled',
        bufferPostId,
        scheduledAt: scheduledAt ? new Date(scheduledAt * 1000) : post.scheduledAt,
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
export async function pullAnalytics(postId) {
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post?.bufferPostId) return null;

  try {
    const res = await fetch(
      `${BUFFER_API}/updates/${post.bufferPostId}.json?access_token=${getToken()}`,
    );
    if (!res.ok) return null;
    const data = await res.json();

    const analyticsData = {
      impressions: data.statistics?.impressions ?? 0,
      reach: data.statistics?.reach ?? 0,
      clicks: data.statistics?.clicks ?? 0,
      likes: data.statistics?.likes ?? 0,
      comments: data.statistics?.comments ?? 0,
      shares: data.statistics?.shares ?? 0,
      pulledAt: new Date().toISOString(),
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
// ---------------------------------------------------------------------------
export function computeScheduledAt(platform, settings, weekStart, index = 0, total = 1) {
  // Resolve per-platform config from settings
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

  // Timezone offset in hours from UTC (e.g. -4 for US Eastern Daylight Time).
  // Stored in SocialSettings.timezoneOffset so it can be changed from the UI.
  const tzOffsetHours = settings?.timezoneOffset ?? 0;

  // Collect all valid days within the 7-day week window
  const base = new Date(weekStart || Date.now());
  const validDays = [];
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + offset);
    if (daysMask & (1 << d.getUTCDay())) {
      validDays.push(new Date(d));
    }
  }

  // Fallback: use tomorrow if no valid days found
  if (!validDays.length) {
    const fallback = new Date(base);
    fallback.setUTCDate(fallback.getUTCDate() + 1);
    fallback.setUTCHours(startH - tzOffsetHours, startM, 0, 0);
    return fallback;
  }

  // Distribute: postsPerDay = ceil(total / validDays.length)
  const postsPerDay = Math.ceil(total / validDays.length);

  // Which day and which slot within that day
  const dayIndex  = Math.floor(index / postsPerDay);
  const slotIndex = index % postsPerDay;

  const chosenDay = validDays[dayIndex % validDays.length];

  // Compute minute offset within the window
  let minuteOffset = 0;
  if (postsPerDay > 1 && windowEndMin > windowStartMin) {
    minuteOffset = slotIndex * ((windowEndMin - windowStartMin) / (postsPerDay - 1));
  }

  const totalMinutes = windowStartMin + minuteOffset;
  const localHour   = Math.floor(totalMinutes / 60);
  const localMinute = Math.round(totalMinutes % 60);

  // Convert local time to UTC: UTC = local - offset  (e.g. 10:00 EDT with offset -4 → 14:00 UTC)
  const utcHour = localHour - tzOffsetHours;
  chosenDay.setUTCHours(utcHour, localMinute, 0, 0);
  return chosenDay;
}
