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

  // Twitter Premium removes the classic 280-char cap (up to 25,000 chars for
  // longform posts), so the caption is no longer truncated to make room for
  // the CTA — it's simply appended like every other platform.
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
        errorMessage: null,
      },
    });

    return bufferPostId;
  } catch (error) {
    // Revert to "uploaded" rather than "failed" — this post's content/images
    // are still perfectly good, only the Buffer call itself didn't go
    // through (often a rate limit on larger batches). "failed" is treated
    // elsewhere as an export/content problem (Retry Failed and Export All
    // both re-run Playwright export for it, wastefully re-generating images
    // that were never the issue). Staying "uploaded" keeps the error visible
    // via errorMessage while letting a plain re-send (Send to Buffer /
    // Schedule All) retry the one thing that actually failed.
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'uploaded', errorMessage: error.message },
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

export function computeScheduledAt(platform, settings, weekStart, index = 0, total = 1, windowDays = 7) {
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
  const days = Math.max(1, windowDays || 7);
  for (let offset = 0; offset < days; offset++) {
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

// ---------------------------------------------------------------------------
// randomizePlatformSchedule — re-bucket a platform's not-yet-sent posts
// across the posting window, either with even spacing or a randomized
// day/time assignment. Only touches posts with bufferPostId === null — posts
// already pushed to Buffer keep whatever time was sent there, but their
// existing scheduledAt is treated as an "occupied" slot so new posts are
// woven around them instead of landing on/next to the same days and times.
// ---------------------------------------------------------------------------

const PLATFORM_SETTINGS_KEYS = {
  instagram_carousel: { days: 'instagramCarouselDays', start: 'instagramCarouselWindowStart', end: 'instagramCarouselWindowEnd' },
  instagram_story:    { days: 'instagramStoryDays',    start: 'instagramStoryWindowStart',    end: 'instagramStoryWindowEnd' },
  linkedin:           { days: 'linkedinDays',           start: 'linkedinWindowStart',           end: 'linkedinWindowEnd' },
  twitter:            { days: 'twitterDays',            start: 'twitterWindowStart',            end: 'twitterWindowEnd' },
};

// Mirrors the SocialSettings @default values (prisma/schema.prisma) — used
// only if the singleton row is somehow missing a field.
const PLATFORM_SCHEDULE_DEFAULTS = {
  instagram_carousel: { days: 28, start: '10:00', end: '10:00' },
  instagram_story:    { days: 62, start: '08:00', end: '20:00' },
  linkedin:           { days: 20, start: '09:00', end: '09:00' },
  twitter:            { days: 42, start: '10:00', end: '10:00' },
};

function buildValidDays(daysMask, weekStart, windowDays) {
  const base = new Date(weekStart || Date.now());
  const validDays = [];
  const days = Math.max(1, windowDays || 7);
  for (let offset = 0; offset < days; offset++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + offset);
    if (daysMask & (1 << d.getUTCDay())) {
      validDays.push(new Date(d));
    }
  }
  return validDays.length ? validDays : [new Date(base)];
}

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Never let a post land before its article actually goes live on WordPress —
// same guard used at initial pipeline creation (social-pipeline.service.js).
function clampToPublishDate(scheduledAt, publishDate) {
  if (publishDate && scheduledAt < publishDate) {
    return new Date(publishDate.getTime() + 30 * 60 * 1000);
  }
  return scheduledAt;
}

function dayKeyUTC(d) {
  return d.toISOString().slice(0, 10);
}

export async function randomizePlatformSchedule({ campaignId, platform, mode, daysMask, windowStart, windowEnd }) {
  const keys = PLATFORM_SETTINGS_KEYS[platform];
  if (!keys) throw new Error(`Unknown platform: ${platform}`);

  const campaign = await prisma.socialCampaign.findUnique({
    where: { id: campaignId },
    select: { weekStart: true, weekEnd: true },
  });
  if (!campaign) throw new Error(`SocialCampaign not found: ${campaignId}`);

  const settings = await prisma.socialSettings.findUnique({ where: { id: 'singleton' } });
  const defaults = PLATFORM_SCHEDULE_DEFAULTS[platform];

  const effectiveDaysMask = daysMask ?? settings?.[keys.days] ?? defaults.days;
  const effectiveWindowStart = windowStart ?? settings?.[keys.start] ?? defaults.start;
  const effectiveWindowEnd = windowEnd ?? settings?.[keys.end] ?? defaults.end;
  const tzOffsetHours = settings?.timezoneOffset ?? 0;

  // Load EVERY post for this platform/campaign — not just the eligible ones
  // — so already-scheduled (sent-to-Buffer) posts can be treated as fixed
  // occupied slots. Ignoring them entirely (as before) meant the randomizer
  // had no idea a day was already full and would happily pile new posts
  // right on top of / next to whatever was already scheduled there.
  const allPosts = await prisma.socialPost.findMany({
    where: { campaignId, platform },
    include: { article: { select: { publishDate: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const lockedPosts = allPosts.filter((p) => p.bufferPostId && p.scheduledAt);
  const eligiblePosts = allPosts.filter((p) => !p.bufferPostId);

  if (!eligiblePosts.length) return { count: 0 };

  const windowDays = Math.max(
    1,
    Math.round((campaign.weekEnd - campaign.weekStart) / (24 * 60 * 60 * 1000)) + 1,
  );

  const validDays = buildValidDays(effectiveDaysMask, campaign.weekStart, windowDays);
  const [startH, startM] = effectiveWindowStart.split(':').map(Number);
  const [endH, endM] = effectiveWindowEnd.split(':').map(Number);
  const windowStartMin = startH * 60 + startM;
  const windowEndMin = endH * 60 + endM;

  // Seed each valid day's load with however many locked posts already fall
  // on it (a locked post on a day outside this run's valid days/window just
  // doesn't count toward anyone's load — nothing we can do about that slot).
  const dayIndexByKey = new Map(validDays.map((d, i) => [dayKeyUTC(d), i]));
  const load = new Array(validDays.length).fill(0);
  const lockedMinutesByDayIndex = new Map();
  for (const post of lockedPosts) {
    const scheduled = new Date(post.scheduledAt);
    const idx = dayIndexByKey.get(dayKeyUTC(scheduled));
    if (idx === undefined) continue;
    load[idx] += 1;
    const localMinutes = ((scheduled.getUTCHours() + tzOffsetHours) * 60 + scheduled.getUTCMinutes() + 1440) % 1440;
    if (!lockedMinutesByDayIndex.has(idx)) lockedMinutesByDayIndex.set(idx, []);
    lockedMinutesByDayIndex.get(idx).push(localMinutes);
  }

  // Assign each eligible post to whichever valid day currently has the
  // fewest posts (locked + already-assigned-this-run), always filling the
  // least-crowded day first — this naturally weaves new posts into the gaps
  // around already-scheduled ones instead of ignoring them.
  const orderedPosts = mode === 'random' ? shuffle(eligiblePosts) : eligiblePosts;
  const assignments = validDays.map(() => []);

  for (const post of orderedPosts) {
    const minLoad = Math.min(...load);
    const candidates = [];
    for (let i = 0; i < load.length; i++) {
      if (load[i] === minLoad) candidates.push(i);
    }
    const chosenIdx = mode === 'random'
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : candidates[0];
    assignments[chosenIdx].push(post);
    load[chosenIdx] += 1;
  }

  const updates = [];

  assignments.forEach((dayPosts, dayIdx) => {
    if (!dayPosts.length) return;
    const lockedMinutes = lockedMinutesByDayIndex.get(dayIdx) || [];

    dayPosts.forEach((post, slotIndex) => {
      const chosenDay = new Date(validDays[dayIdx]);
      let localMinutes;

      if (mode === 'random') {
        // Try a few times to land clear of already-locked times that day
        // (at least 20 minutes away) before giving up and using the last roll.
        let attempt = 0;
        do {
          localMinutes = windowEndMin > windowStartMin
            ? windowStartMin + Math.random() * (windowEndMin - windowStartMin)
            : windowStartMin;
          attempt++;
        } while (
          attempt < 6 &&
          lockedMinutes.some((m) => Math.abs(m - localMinutes) < 20)
        );
      } else {
        // Even spread: total slots for the day include the posts already
        // locked there, so new posts fill in AFTER them instead of
        // overlapping the same early slice of the window.
        const totalSlotsForDay = dayPosts.length + lockedMinutes.length;
        const ownSlot = lockedMinutes.length + slotIndex;
        localMinutes = totalSlotsForDay > 1 && windowEndMin > windowStartMin
          ? windowStartMin + ownSlot * ((windowEndMin - windowStartMin) / (totalSlotsForDay - 1))
          : windowStartMin;
      }

      const localHour = Math.floor(localMinutes / 60);
      const localMinute = Math.round(localMinutes % 60);
      chosenDay.setUTCHours(localHour - tzOffsetHours, localMinute, 0, 0);

      updates.push({
        id: post.id,
        scheduledAt: clampToPublishDate(chosenDay, post.article?.publishDate),
      });
    });
  });

  await prisma.$transaction(
    updates.map((u) => prisma.socialPost.update({ where: { id: u.id }, data: { scheduledAt: u.scheduledAt } })),
  );

  return { count: updates.length };
}
