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
// computeScheduledAt — helper to calculate next available slot time
// ---------------------------------------------------------------------------
export function computeScheduledAt(platform, settings, weekStart) {
  const timeMap = {
    instagram_carousel: settings?.instagramPostTime || '09:00',
    instagram_story: settings?.instagramPostTime || '09:00',
    linkedin: settings?.linkedinPostTime || '08:00',
    twitter: settings?.twitterPostTime || '10:00',
  };

  const daysMap = {
    instagram_carousel: settings?.instagramPostDays ?? 62,
    instagram_story: settings?.instagramPostDays ?? 62,
    linkedin: settings?.linkedinPostDays ?? 40,
    twitter: settings?.twitterPostDays ?? 62,
  };

  const [hour, minute] = (timeMap[platform] || '09:00').split(':').map(Number);
  const daysMask = daysMap[platform] ?? 62;

  // Find next valid day from weekStart
  const base = new Date(weekStart || Date.now());
  for (let offset = 0; offset < 14; offset++) {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    const dayBit = 1 << d.getDay();
    if (daysMask & dayBit) {
      d.setHours(hour, minute, 0, 0);
      return d;
    }
  }
  // Fallback: use tomorrow at the configured time
  const fallback = new Date(base);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(hour, minute, 0, 0);
  return fallback;
}
