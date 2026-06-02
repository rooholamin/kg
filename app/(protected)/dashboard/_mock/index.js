/**
 * TODO(Milestone 2+): Replace with API / Prisma-backed data.
 * Milestone 1 — isolated mock data for dashboard UI only.
 */

export const PIPELINE_STAGES = [
  { id: 'planning', label: 'Planning', order: 1 },
  { id: 'research', label: 'Research', order: 2 },
  { id: 'writing', label: 'Writing', order: 3 },
  { id: 'assets', label: 'Asset Generation', order: 4 },
  { id: 'approval', label: 'Approval', order: 5 },
  { id: 'scheduling', label: 'Scheduling', order: 6 },
  { id: 'publishing', label: 'Publishing', order: 7 },
  { id: 'post_publish', label: 'Post-Publish', order: 8 },
];

export const MOCK_CATEGORIES = [
  {
    id: 'cat-1',
    name: 'Finance',
    slug: 'finance',
    description: 'Personal finance, investing, and retirement.',
    status: 'active',
    topicCount: 4,
    articleCount: 12,
    createdAt: '2025-11-02T10:00:00.000Z',
  },
  {
    id: 'cat-2',
    name: 'Technology',
    slug: 'technology',
    description: 'Tools, AI, and digital productivity.',
    status: 'active',
    topicCount: 3,
    articleCount: 9,
    createdAt: '2025-11-10T14:30:00.000Z',
  },
  {
    id: 'cat-3',
    name: 'Lifestyle',
    slug: 'lifestyle',
    description: 'Wellness, travel, and culture.',
    status: 'archived',
    topicCount: 1,
    articleCount: 2,
    createdAt: '2025-09-01T09:00:00.000Z',
  },
];

export const MOCK_TOPICS = [
  {
    id: 'top-1',
    title: 'Retirement Planning',
    categoryId: 'cat-1',
    categoryName: 'Finance',
    description: 'Long-term retirement strategies and accounts.',
    targetKeyword: 'retirement planning',
    tags: ['401k', 'IRA', 'savings'],
    priority: 'high',
    status: 'active',
    articleCount: 5,
    readinessSummary: '3 on track, 1 at risk',
  },
  {
    id: 'top-2',
    title: 'AI Tools',
    categoryId: 'cat-2',
    categoryName: 'Technology',
    description: 'Reviews and roundups of AI software.',
    targetKeyword: 'best AI tools',
    tags: ['AI', 'productivity', 'SaaS'],
    priority: 'medium',
    status: 'active',
    articleCount: 4,
    readinessSummary: '2 on track, 2 pending review',
  },
  {
    id: 'top-3',
    title: 'Budgeting Basics',
    categoryId: 'cat-1',
    categoryName: 'Finance',
    description: 'Foundational budgeting content.',
    targetKeyword: 'how to budget',
    tags: ['budget', 'spending'],
    priority: 'low',
    status: 'draft',
    articleCount: 3,
    readinessSummary: '1 on track',
  },
];

export const MOCK_ARTICLES = [
  {
    id: 'art-1',
    title: '5 Ways to Maximize Your 401(k) in 2026',
    topicId: 'top-1',
    topicTitle: 'Retirement Planning',
    categoryId: 'cat-1',
    categoryName: 'Finance',
    stage: 'review',
    publishDate: '2026-05-15',
    readinessDeadline: '2026-05-08',
    readiness: 'on_track',
    assignee: { name: 'Alex Morgan', initials: 'AM' },
    seoScore: '—',
    wordpressStatus: 'Not synced',
    targetKeyword: '401k maximize',
    brief:
      'Actionable steps readers can take this year to increase retirement contributions and matches.',
    risk: 'low',
  },
  {
    id: 'art-2',
    title: 'The Best AI Writing Assistants Compared',
    topicId: 'top-2',
    topicTitle: 'AI Tools',
    categoryId: 'cat-2',
    categoryName: 'Technology',
    stage: 'writing',
    publishDate: '2026-04-28',
    readinessDeadline: '2026-04-21',
    readiness: 'at_risk',
    assignee: { name: 'Sam Chen', initials: 'SC' },
    seoScore: '72',
    wordpressStatus: 'Not synced',
    targetKeyword: 'AI writing tools',
    brief: 'Head-to-head comparison with pricing and use cases.',
    risk: 'medium',
  },
  {
    id: 'art-3',
    title: 'Zero-Based Budgeting in Under an Hour',
    topicId: 'top-3',
    topicTitle: 'Budgeting Basics',
    categoryId: 'cat-1',
    categoryName: 'Finance',
    stage: 'planning',
    publishDate: '2026-06-01',
    readinessDeadline: '2026-05-25',
    readiness: 'on_track',
    assignee: { name: 'Jordan Lee', initials: 'JL' },
    seoScore: '—',
    wordpressStatus: 'Not synced',
    targetKeyword: 'zero based budgeting',
    brief: 'Step-by-step template and examples.',
    risk: 'low',
  },
  {
    id: 'art-4',
    title: 'YouTube Thumbnails That Convert',
    topicId: 'top-2',
    topicTitle: 'AI Tools',
    categoryId: 'cat-2',
    categoryName: 'Technology',
    stage: 'scheduling',
    publishDate: '2026-04-20',
    readinessDeadline: '2026-04-13',
    readiness: 'overdue',
    assignee: { name: 'Sam Chen', initials: 'SC' },
    seoScore: '65',
    wordpressStatus: 'Draft on WP',
    targetKeyword: 'YouTube thumbnail design',
    brief: 'Design patterns backed by A/B data.',
    risk: 'high',
  },
];

export const MOCK_SOCIAL_OUTPUTS = [
  {
    id: 'so-1',
    platform: 'instagram',
    label: 'Instagram',
    status: 'draft',
    summary: 'Carousel + caption shell',
  },
  {
    id: 'so-2',
    platform: 'x',
    label: 'X / Twitter',
    status: 'not_started',
    summary: 'Thread outline',
  },
  {
    id: 'so-3',
    platform: 'youtube',
    label: 'YouTube',
    status: 'draft',
    summary: 'Short script placeholder',
  },
  {
    id: 'so-4',
    platform: 'linkedin',
    label: 'LinkedIn',
    status: 'not_started',
    summary: 'Post stub',
  },
];

export const MOCK_ACTIVITY = [
  {
    id: 'log-1',
    type: 'Pipeline',
    message: 'Article moved to Review',
    user: 'Alex Morgan',
    entity: 'art-1',
    at: '2026-04-18T11:20:00.000Z',
    status: 'success',
  },
  {
    id: 'log-2',
    type: 'System',
    message: 'Readiness check scheduled',
    user: 'System',
    entity: '—',
    at: '2026-04-18T09:00:00.000Z',
    status: 'info',
  },
  {
    id: 'log-3',
    type: 'User',
    message: 'Topic description updated',
    user: 'Jordan Lee',
    entity: 'top-3',
    at: '2026-04-17T16:45:00.000Z',
    status: 'success',
  },
  {
    id: 'log-4',
    type: 'Approval',
    message: 'Publish request pending',
    user: 'Sam Chen',
    entity: 'art-4',
    at: '2026-04-17T14:10:00.000Z',
    status: 'warning',
  },
  {
    id: 'log-5',
    type: 'Integration',
    message: 'WordPress sync (simulated failure)',
    user: 'n8n',
    entity: 'art-2',
    at: '2026-04-16T20:00:00.000Z',
    status: 'error',
  },
];

export const MOCK_LOGS = [
  ...MOCK_ACTIVITY,
  {
    id: 'log-6',
    type: 'Pipeline',
    message: 'Stage transition: Writing → Review',
    user: 'Alex Morgan',
    entity: 'art-1',
    at: '2026-04-15T10:00:00.000Z',
    status: 'success',
  },
  {
    id: 'log-7',
    type: 'User',
    message: 'Login from new device',
    user: 'Jordan Lee',
    entity: '—',
    at: '2026-04-14T08:12:00.000Z',
    status: 'info',
  },
];

export const MOCK_AI_ATTEMPTS = [
  {
    id: 'att-1',
    articleId: 'art-2',
    articleTitle: 'The Best AI Writing Assistants Compared',
    model: '— (Milestone 9)',
    promptPreview: 'Compare top 5 AI writing tools with a table and pricing...',
    resultPreview: 'Simulated: draft outline only — not persisted.',
    createdAt: '2026-04-17T13:00:00.000Z',
  },
  {
    id: 'att-2',
    articleId: 'art-1',
    articleTitle: '5 Ways to Maximize Your 401(k) in 2026',
    model: '— (Milestone 9)',
    promptPreview: 'List IRS contribution limits and employer match tips...',
    resultPreview: 'Simulated: bullet list draft.',
    createdAt: '2026-04-16T09:15:00.000Z',
  },
];

export const MOCK_USERS = [
  {
    id: 'u-1',
    name: 'Alex Morgan',
    email: 'alex@example.com',
    role: 'Admin',
    status: 'ACTIVE',
    lastActive: '2026-04-18T10:00:00.000Z',
  },
  {
    id: 'u-2',
    name: 'Sam Chen',
    email: 'sam@example.com',
    role: 'User',
    status: 'ACTIVE',
    lastActive: '2026-04-18T08:30:00.000Z',
  },
  {
    id: 'u-3',
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    role: 'User',
    status: 'INACTIVE',
    lastActive: '2026-04-10T12:00:00.000Z',
  },
];

export const MOCK_APPROVALS = [
  {
    id: 'ap-1',
    action: 'Publish article',
    requestedBy: 'Sam Chen',
    risk: 'medium',
    entity: 'art-4 — YouTube Thumbnails…',
    status: 'pending',
    notes: '—',
  },
  {
    id: 'ap-2',
    action: 'Delete topic (dry run)',
    requestedBy: 'Alex Morgan',
    risk: 'high',
    entity: 'top-3 — Budgeting Basics',
    status: 'pending',
    notes: '—',
  },
  {
    id: 'ap-3',
    action: 'Bulk AI generation',
    requestedBy: 'Sam Chen',
    risk: 'high',
    entity: '4 articles in AI Tools',
    status: 'approved',
    notes: 'Approved for Milestone 9 rehearsal',
  },
  {
    id: 'ap-4',
    action: 'WordPress push',
    requestedBy: 'Jordan Lee',
    risk: 'low',
    entity: 'art-1',
    status: 'rejected',
    notes: 'Hold until review completes',
  },
];

export const MOCK_INTEGRATIONS = [
  {
    id: 'int-wp',
    name: 'WordPress',
    description: 'Publish destination for articles',
    status: 'not_connected',
    milestone: 8,
  },
  {
    id: 'int-ai',
    name: 'AI provider',
    description: 'Chat and generation',
    status: 'not_connected',
    milestone: 9,
  },
  {
    id: 'int-n8n',
    name: 'n8n',
    description: 'Workflow automation',
    status: 'not_connected',
    milestone: 10,
  },
  {
    id: 'int-mcp',
    name: 'MCP / tools',
    description: 'Tool connectors for agents',
    status: 'not_connected',
    milestone: 9,
  },
  {
    id: 'int-ig',
    name: 'Instagram',
    description: 'Social output',
    status: 'not_connected',
    milestone: 10,
  },
  {
    id: 'int-x',
    name: 'X / Twitter',
    description: 'Social output',
    status: 'not_connected',
    milestone: 10,
  },
  {
    id: 'int-yt',
    name: 'YouTube',
    description: 'Social output',
    status: 'not_connected',
    milestone: 10,
  },
  {
    id: 'int-li',
    name: 'LinkedIn',
    description: 'Social output',
    status: 'not_connected',
    milestone: 10,
  },
  {
    id: 'int-email',
    name: 'Email / notifications',
    description: 'Approvals and alerts',
    status: 'not_connected',
    milestone: 10,
  },
];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function atHour(date, h) {
  const d = new Date(date);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
}

const today = new Date();
const base = startOfDay(today);

export const MOCK_CALENDAR_EVENTS = [
  {
    id: 'ev-1',
    title: 'Publish: 401k article',
    start: atHour(base, 10),
    end: atHour(base, 11),
    allDay: false,
    color: 'violet',
    source: 'articles',
  },
  {
    id: 'ev-2',
    title: 'Readiness deadline: AI tools article',
    start: atHour(new Date(base.getTime() + 86400000 * 2), 9),
    end: atHour(new Date(base.getTime() + 86400000 * 2), 10),
    allDay: false,
    color: 'rose',
    source: 'readiness',
  },
  {
    id: 'ev-3',
    title: 'IG: Carousel draft review',
    start: atHour(new Date(base.getTime() + 86400000 * 1), 14),
    end: atHour(new Date(base.getTime() + 86400000 * 1), 15),
    allDay: false,
    color: 'amber',
    source: 'instagram',
  },
  {
    id: 'ev-4',
    title: 'X thread: product launch',
    start: atHour(new Date(base.getTime() + 86400000 * 3), 11),
    end: atHour(new Date(base.getTime() + 86400000 * 3), 12),
    allDay: false,
    color: 'sky',
    source: 'x',
  },
  {
    id: 'ev-5',
    title: 'YouTube: Short script review',
    start: atHour(new Date(base.getTime() + 86400000 * 4), 16),
    end: atHour(new Date(base.getTime() + 86400000 * 4), 17),
    allDay: false,
    color: 'emerald',
    source: 'youtube',
  },
  {
    id: 'ev-6',
    title: 'LinkedIn: post draft',
    start: (() => {
      const d = new Date(base.getTime() + 86400000 * 5);
      d.setHours(10, 0, 0, 0);
      return d.toISOString();
    })(),
    end: (() => {
      const d = new Date(base.getTime() + 86400000 * 5);
      d.setHours(10, 30, 0, 0);
      return d.toISOString();
    })(),
    allDay: false,
    color: 'amber',
    source: 'linkedin',
  },
  {
    id: 'ev-7',
    title: 'Newsletter: digest send',
    start: atHour(new Date(base.getTime() + 86400000 * 6), 8),
    end: atHour(new Date(base.getTime() + 86400000 * 6), 9),
    allDay: false,
    color: 'orange',
    source: 'newsletter',
  },
];

export const MOCK_SEO_ARTICLES = [
  {
    id: 'art-2',
    title: 'The Best AI Writing Assistants Compared',
    keyword: 'AI writing tools',
    score: 72,
    internalLinks: 0,
    needsReview: true,
  },
  {
    id: 'art-1',
    title: '5 Ways to Maximize Your 401(k) in 2026',
    keyword: '401k maximize',
    score: 58,
    internalLinks: 0,
    needsReview: true,
  },
  {
    id: 'art-4',
    title: 'YouTube Thumbnails That Convert',
    keyword: 'YouTube thumbnail design',
    score: 65,
    internalLinks: 1,
    needsReview: false,
  },
];

export function getCategoryById(id) {
  return MOCK_CATEGORIES.find((c) => c.id === id) ?? null;
}

export function getTopicById(id) {
  return MOCK_TOPICS.find((t) => t.id === id) ?? null;
}

export function getArticleById(id) {
  const a = MOCK_ARTICLES.find((x) => x.id === id);
  if (!a) return null;
  return {
    ...a,
    social: MOCK_SOCIAL_OUTPUTS,
    versions: [],
  };
}

export function getTopicsByCategoryId(categoryId) {
  return MOCK_TOPICS.filter((t) => t.categoryId === categoryId);
}

export function getArticlesByCategoryId(categoryId) {
  return MOCK_ARTICLES.filter((a) => a.categoryId === categoryId);
}

export function getArticlesByTopicId(topicId) {
  return MOCK_ARTICLES.filter((a) => a.topicId === topicId);
}

export const PIPELINE_COUNTS = MOCK_ARTICLES.reduce(
  (acc, a) => {
    acc[a.stage] = (acc[a.stage] ?? 0) + 1;
    return acc;
  },
  {},
);

export const DASHBOARD_STATS = {
  categories: MOCK_CATEGORIES.filter((c) => c.status === 'active').length,
  topics: MOCK_TOPICS.length,
  articles: MOCK_ARTICLES.length,
  atRisk: MOCK_ARTICLES.filter(
    (a) => a.readiness === 'at_risk' || a.readiness === 'overdue',
  ).length,
  pendingApprovals: MOCK_APPROVALS.filter((x) => x.status === 'pending')
    .length,
  avgSeoScore: '62',
};
