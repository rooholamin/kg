import { prisma } from '@/lib/prisma';
import { computeReadiness } from '@/services/article.service';

const TREND_WEEKS = 8;
const MS_PER_DAY = 86400000;
const MS_PER_WEEK = MS_PER_DAY * 7;

/** Ordered pipeline stages — mirrors the ArticleStatus enum. */
export const PIPELINE_STAGES = [
  { id: 'planning', label: 'Planning' },
  { id: 'research', label: 'Research' },
  { id: 'writing', label: 'Writing' },
  { id: 'assets', label: 'Asset generation' },
  { id: 'approval', label: 'Approval' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'publishing', label: 'Publishing' },
  { id: 'post_publish', label: 'Post-publish' },
];

/** Readiness statuses ('ok' | 'warning' | 'risk') mapped to the dashboard's display labels. */
const READINESS_DISPLAY = {
  ok: 'on_track',
  warning: 'at_risk',
  risk: 'overdue',
};

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function weekLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildWeeklyBuckets() {
  const since = startOfWeek(new Date());
  since.setDate(since.getDate() - (TREND_WEEKS - 1) * 7);
  const buckets = [];
  for (let i = 0; i < TREND_WEEKS; i++) {
    const weekStart = new Date(since.getTime() + i * MS_PER_WEEK);
    buckets.push({ weekStart, label: weekLabel(weekStart), articles: 0, tasks: 0 });
  }
  return { since, buckets };
}

function bucketIndexFor(since, date) {
  const idx = Math.floor((new Date(date).getTime() - since.getTime()) / MS_PER_WEEK);
  return Math.min(Math.max(idx, 0), TREND_WEEKS - 1);
}

async function getWeeklyTrend() {
  const { since, buckets } = buildWeeklyBuckets();

  const [articleDates, logDates] = await Promise.all([
    prisma.article.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.contentLog.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  articleDates.forEach((a) => {
    buckets[bucketIndexFor(since, a.createdAt)].articles += 1;
  });
  logDates.forEach((l) => {
    buckets[bucketIndexFor(since, l.createdAt)].tasks += 1;
  });

  return buckets.map(({ label, articles, tasks }) => ({ week: label, articles, tasks }));
}

/**
 * Resolve createdBy user ids on a batch of content-log rows into display names,
 * mirroring the mapping used by /api/logs.
 */
async function withUserLabels(rows) {
  const userIds = [...new Set(rows.map((r) => r.createdBy).filter(Boolean))];
  let userMap = {};
  if (userIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    userMap = Object.fromEntries(users.map((u) => [u.id, u.name?.trim() || u.email || u.id]));
  }
  return rows.map((r) => ({
    ...r,
    userLabel: r.createdBy ? userMap[r.createdBy] ?? 'System' : 'System',
  }));
}

/** Live connection status for each external system, derived from settings rows / env vars. */
async function getIntegrations() {
  const [wpSectionCount, seoSettings, socialSettings, videoSettings, sectionCount] =
    await Promise.all([
      prisma.section.count({ where: { wpSiteUrl: { not: null } } }),
      prisma.seoSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null),
      prisma.socialSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null),
      prisma.videoSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null),
      prisma.section.count(),
    ]);

  const aiAgentConfigured = Boolean(
    seoSettings?.seoAgentId ||
      socialSettings?.approvalAgentId ||
      socialSettings?.contentAgentId ||
      videoSettings?.approvalAgentId ||
      videoSettings?.plannerAgentId,
  );
  const socialChannelsConfigured = Boolean(
    socialSettings?.instagramChannelId ||
      socialSettings?.linkedinChannelId ||
      socialSettings?.twitterChannelId,
  );

  return [
    {
      id: 'wordpress',
      name: 'WordPress',
      description: 'Publish destination for articles',
      connected: wpSectionCount > 0,
      detail: wpSectionCount > 0 ? `${wpSectionCount} of ${sectionCount} sections linked` : 'No sections linked',
      href: '/dashboard/sections',
    },
    {
      id: 'ai-agents',
      name: 'AI agents',
      description: 'Research, writing, SEO & social/video approval agents',
      connected: aiAgentConfigured,
      detail: aiAgentConfigured ? 'Agent IDs configured' : 'No agents configured',
      href: '/dashboard/settings/integrations',
    },
    {
      id: 'n8n',
      name: 'n8n',
      description: 'Workflow automation for scheduling & AI calls',
      connected: Boolean(process.env.N8N_WEBHOOK_SECRET),
      detail: process.env.N8N_WEBHOOK_SECRET ? 'Webhook secret configured' : 'Webhook secret missing',
      href: '/dashboard/scheduler',
    },
    {
      id: 'social',
      name: 'Social (Buffer)',
      description: 'Instagram, LinkedIn & X scheduling',
      connected: Boolean(process.env.BUFFER_ACCESS_TOKEN) && socialChannelsConfigured,
      detail: socialChannelsConfigured ? 'Channels connected' : 'No channels connected',
      href: '/dashboard/social/settings',
    },
    {
      id: 'video',
      name: 'Higgsfield video',
      description: 'AI video generation pipeline',
      connected: Boolean(videoSettings?.higgsfieldVaultId),
      detail: videoSettings?.higgsfieldVaultId ? 'Vault connected' : 'Vault not connected',
      href: '/dashboard/video/settings',
    },
    {
      id: 'voice',
      name: 'ElevenLabs',
      description: 'Narration & caption voice generation',
      connected: Boolean(process.env.ELEVENLABS_API_KEY),
      detail: process.env.ELEVENLABS_API_KEY ? 'API key configured' : 'API key missing',
      href: '/dashboard/video/settings',
    },
    {
      id: 'storage',
      name: 'DigitalOcean Spaces',
      description: 'Media & asset storage (CDN)',
      connected: Boolean(process.env.STORAGE_ACCESS_KEY_ID),
      detail: process.env.STORAGE_ACCESS_KEY_ID ? 'Credentials configured' : 'Credentials missing',
      href: '/dashboard/settings',
    },
  ];
}

/** Merge live schedule sources (articles, social posts, video posts, scheduler slots) into one upcoming feed. */
async function getUpcomingSchedule(limit = 8) {
  const now = new Date();

  const [articles, socialPosts, videoPosts, slots] = await Promise.all([
    prisma.article.findMany({
      where: { publishDate: { gte: now } },
      orderBy: { publishDate: 'asc' },
      take: limit,
      select: { id: true, title: true, publishDate: true },
    }),
    prisma.socialPost.findMany({
      where: { scheduledAt: { gte: now } },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      select: { id: true, platform: true, scheduledAt: true, article: { select: { title: true } } },
    }),
    prisma.videoPost.findMany({
      where: { scheduledAt: { gte: now } },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      select: {
        id: true,
        scheduledAt: true,
        customTitle: true,
        article: { select: { title: true } },
      },
    }),
    prisma.scheduledArticleSlot.findMany({
      where: { status: 'planned', scheduledDate: { gte: now } },
      orderBy: { scheduledDate: 'asc' },
      take: limit,
      select: { id: true, scheduledDate: true, topicId: true },
    }),
  ]);

  // ScheduledArticleSlot.topicId has no Prisma relation field (plain FK) —
  // resolve topic names with a separate batch lookup, same pattern used by
  // services/scheduler.service.js.
  const slotTopicIds = [...new Set(slots.map((s) => s.topicId).filter(Boolean))];
  const slotTopics = slotTopicIds.length
    ? await prisma.topic.findMany({ where: { id: { in: slotTopicIds } }, select: { id: true, name: true } })
    : [];
  const slotTopicMap = Object.fromEntries(slotTopics.map((t) => [t.id, t.name]));

  const events = [
    ...articles.map((a) => ({
      id: `article-${a.id}`,
      title: `Publish: ${a.title}`,
      start: a.publishDate,
      source: 'articles',
      color: 'violet',
    })),
    ...socialPosts.map((p) => ({
      id: `social-${p.id}`,
      title: `${p.platform.replace(/_/g, ' ')}: ${p.article?.title ?? 'Social post'}`,
      start: p.scheduledAt,
      source: 'social',
      color: 'amber',
    })),
    ...videoPosts.map((v) => ({
      id: `video-${v.id}`,
      title: `Video: ${v.article?.title ?? v.customTitle ?? 'Untitled video'}`,
      start: v.scheduledAt,
      source: 'video',
      color: 'sky',
    })),
    ...slots.map((s) => ({
      id: `slot-${s.id}`,
      title: `Planned: ${slotTopicMap[s.topicId] ?? 'Untitled topic'}`,
      start: s.scheduledDate,
      source: 'scheduler',
      color: 'emerald',
    })),
  ];

  return events
    .filter((e) => e.start)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, limit);
}

/**
 * Single aggregate payload for the main operations dashboard — every field is
 * computed live from the database (no mock data).
 */
export async function getDashboardOverview() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const atRiskQueueStatuses = ['planning', 'research', 'writing', 'assets'];

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const warningCutoff = new Date(endOfToday.getTime() + 2 * MS_PER_DAY);

  const [
    sectionsRaw,
    categoriesActive,
    categoriesTotal,
    categoriesCreatedThisWeek,
    topicsActive,
    topicsTotal,
    topicsCreatedThisWeek,
    articlesTotal,
    articlesCreatedThisWeek,
    publishedCount,
    statusGroups,
    avgSeoAgg,
    ideaBacklogNew,
    approvalArticles,
    approvalsTotalCount,
    overdueCount,
    atRiskWarningCount,
    riskCandidates,
    seoSnapshotArticles,
    recentLogsRaw,
    weeklyTrend,
    upcoming,
    integrations,
  ] = await Promise.all([
    prisma.section.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { categories: true } } },
    }),
    prisma.category.count({ where: { status: 'active' } }),
    prisma.category.count(),
    prisma.category.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.topic.count({ where: { status: 'active' } }),
    prisma.topic.count(),
    prisma.topic.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.article.count(),
    prisma.article.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.article.count({ where: { status: 'post_publish' } }),
    prisma.article.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.article.aggregate({
      _avg: { seoScore: true },
      _count: { seoScore: true },
      where: { seoScore: { not: null } },
    }),
    prisma.ideaBacklog.count({ where: { status: 'new' } }),
    prisma.article.findMany({
      where: { status: 'approval' },
      orderBy: { updatedAt: 'asc' },
      take: 6,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        publishDate: true,
        topic: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.article.count({ where: { status: 'approval' } }),
    prisma.article.count({
      where: {
        status: { in: atRiskQueueStatuses },
        readinessDeadline: { lte: endOfToday },
      },
    }),
    prisma.article.count({
      where: {
        status: { in: atRiskQueueStatuses },
        readinessDeadline: { gt: endOfToday, lte: warningCutoff },
      },
    }),
    prisma.article.findMany({
      where: { status: { in: atRiskQueueStatuses }, readinessDeadline: { not: null } },
      orderBy: { readinessDeadline: 'asc' },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        readinessDeadline: true,
        publishDate: true,
        topic: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.article.findMany({
      where: { seoScore: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        title: true,
        seoScore: true,
        seoKeywords: true,
        updatedAt: true,
      },
    }),
    prisma.contentLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    getWeeklyTrend(),
    getUpcomingSchedule(8),
    getIntegrations(),
  ]);

  const sections = sectionsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    characterName: s.characterName,
    categoryCount: s._count.categories,
  }));

  const statusCountMap = Object.fromEntries(statusGroups.map((g) => [g.status, g._count.id]));
  const pipeline = PIPELINE_STAGES.map((stage) => ({
    id: stage.id,
    label: stage.label,
    value: statusCountMap[stage.id] ?? 0,
  }));

  const articlesAtRisk = riskCandidates
    .map((a) => {
      const readiness = computeReadiness(a, now);
      if (readiness !== 'warning' && readiness !== 'risk') return null;
      return {
        id: a.id,
        title: a.title,
        stage: a.status,
        publishDate: a.publishDate,
        readinessDeadline: a.readinessDeadline,
        readiness: READINESS_DISPLAY[readiness] ?? 'on_track',
        topicName: a.topic?.name ?? null,
        categoryName: a.category?.name ?? null,
      };
    })
    .filter(Boolean)
    .slice(0, 6);

  const approvals = approvalArticles.map((a) => ({
    id: a.id,
    title: a.title,
    topicName: a.topic?.name ?? null,
    categoryName: a.category?.name ?? null,
    publishDate: a.publishDate,
    waitingSince: a.updatedAt,
  }));

  const seoSnapshot = seoSnapshotArticles.map((a) => ({
    id: a.id,
    title: a.title,
    score: a.seoScore,
    keyword: a.seoKeywords?.[0] ?? null,
    updatedAt: a.updatedAt,
  }));

  const recentActivity = await withUserLabels(recentLogsRaw);

  const avgSeoScore = avgSeoAgg._avg.seoScore != null ? Math.round(avgSeoAgg._avg.seoScore) : null;
  const seoScoredCount = avgSeoAgg._count.seoScore;

  return {
    generatedAt: now.toISOString(),
    stats: {
      sectionsActive: sections.filter((s) => s.status === 'active').length,
      sectionsTotal: sections.length,
      categoriesActive,
      categoriesTotal,
      categoriesCreatedThisWeek,
      topicsActive,
      topicsTotal,
      topicsCreatedThisWeek,
      articlesTotal,
      articlesCreatedThisWeek,
      publishedCount,
      atRiskCount: overdueCount + atRiskWarningCount,
      overdueCount,
      pendingApprovalsCount: approvalsTotalCount,
      avgSeoScore,
      seoScoredCount,
      ideaBacklogNew,
    },
    sections,
    pipeline,
    trend: weeklyTrend,
    articlesAtRisk,
    approvals,
    seoSnapshot,
    recentActivity,
    upcoming,
    integrations,
  };
}
