/**
 * Fixed IDs for idempotent `upsert` in prisma/seed.js.
 * Categories → topics → articles (order preserved in seed).
 */

const CAT_FINANCE = '11000000-0000-4000-8000-000000000001';
const CAT_TECH = '11000000-0000-4000-8000-000000000002';
const CAT_LIFESTYLE = '11000000-0000-4000-8000-000000000003';

const TOP_RETIRE = '12000000-0000-4000-8000-000000000001';
const TOP_AI = '12000000-0000-4000-8000-000000000002';
const TOP_BUDGET = '12000000-0000-4000-8000-000000000003';
const TOP_WELLNESS = '12000000-0000-4000-8000-000000000004';

const ART_1 = '13000000-0000-4000-8000-000000000001';
const ART_2 = '13000000-0000-4000-8000-000000000002';
const ART_3 = '13000000-0000-4000-8000-000000000003';
const ART_4 = '13000000-0000-4000-8000-000000000004';

const LOG_1 = '14000000-0000-4000-8000-000000000001';
const LOG_2 = '14000000-0000-4000-8000-000000000002';

const APPR_1 = '15000000-0000-4000-8000-000000000001';
const APPR_2 = '15000000-0000-4000-8000-000000000002';

const categories = [
  {
    id: CAT_FINANCE,
    name: 'Finance',
    description: 'Personal finance, investing, and retirement.',
    status: 'active',
  },
  {
    id: CAT_TECH,
    name: 'Technology',
    description: 'Tools, AI, and digital productivity.',
    status: 'active',
  },
  {
    id: CAT_LIFESTYLE,
    name: 'Lifestyle',
    description: 'Wellness, travel, and culture.',
    status: 'archived',
  },
];

const topics = [
  {
    id: TOP_RETIRE,
    name: 'Retirement Planning',
    description: 'Long-term retirement strategies and accounts.',
    categoryId: CAT_FINANCE,
    targetKeyword: 'retirement planning',
    status: 'active',
  },
  {
    id: TOP_AI,
    name: 'AI Tools',
    description: 'Reviews and roundups of AI software.',
    categoryId: CAT_TECH,
    targetKeyword: 'best AI tools',
    status: 'active',
  },
  {
    id: TOP_BUDGET,
    name: 'Budgeting Basics',
    description: 'Foundational budgeting and spending plans.',
    categoryId: CAT_FINANCE,
    targetKeyword: 'budgeting for beginners',
    status: 'active',
  },
  {
    id: TOP_WELLNESS,
    name: 'Wellness Routines',
    description: 'Habits and routines for daily wellness.',
    categoryId: CAT_LIFESTYLE,
    targetKeyword: 'wellness routine',
    status: 'archived',
  },
];

const articles = [
  {
    id: ART_1,
    title: '5 Ways to Maximize Your 401(k) in 2026',
    topicId: TOP_RETIRE,
    categoryId: CAT_FINANCE,
    status: 'review',
    publishDate: new Date('2026-05-15T12:00:00.000Z'),
    readinessDeadline: new Date('2026-05-08T12:00:00.000Z'),
    seoScore: null,
    wordpressPostId: null,
  },
  {
    id: ART_2,
    title: 'The Best AI Writing Assistants Compared',
    topicId: TOP_AI,
    categoryId: CAT_TECH,
    status: 'writing',
    publishDate: new Date('2026-04-28T12:00:00.000Z'),
    readinessDeadline: new Date('2026-04-21T12:00:00.000Z'),
    seoScore: 72,
    wordpressPostId: null,
  },
  {
    id: ART_3,
    title: 'Zero-Based Budgeting in Under an Hour',
    topicId: TOP_BUDGET,
    categoryId: CAT_FINANCE,
    status: 'planning',
    publishDate: new Date('2026-06-01T12:00:00.000Z'),
    readinessDeadline: new Date('2026-05-25T12:00:00.000Z'),
    seoScore: null,
    wordpressPostId: null,
  },
  {
    id: ART_4,
    title: 'YouTube Thumbnails That Convert',
    topicId: TOP_AI,
    categoryId: CAT_TECH,
    status: 'scheduling',
    publishDate: new Date('2026-04-20T12:00:00.000Z'),
    readinessDeadline: new Date('2026-04-13T12:00:00.000Z'),
    seoScore: 65,
    wordpressPostId: 10042,
  },
];

const contentLogs = [
  {
    id: LOG_1,
    type: 'pipeline',
    message: 'Article moved to Review stage',
    entityType: 'article',
    entityId: ART_1,
  },
  {
    id: LOG_2,
    type: 'content',
    message: 'Topic created under Finance',
    entityType: 'topic',
    entityId: TOP_BUDGET,
  },
];

module.exports = {
  categories,
  topics,
  articles,
  contentLogs,
  approvals: { APPR_1, APPR_2 },
  /** @param {string} requestedByUserId */
  getApprovals(requestedByUserId) {
    return [
      {
        id: APPR_1,
        type: 'publish_article',
        status: 'pending',
        requestedBy: requestedByUserId,
      },
      {
        id: APPR_2,
        type: 'delete_topic',
        status: 'approved',
        requestedBy: requestedByUserId,
      },
    ];
  },
};
