/**
 * Home-service / Kingsgate — rich article seed (TipTap JSON) + fixed UUIDs 2300…
 * Topics/categories: see kg-content.js
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const CAT_HVAC = '21000000-0000-4000-8000-000000000001';
const CAT_PLUMB = '21000000-0000-4000-8000-000000000002';
const CAT_ELEC = '21000000-0000-4000-8000-000000000003';
const CAT_SMART = '21000000-0000-4000-8000-000000000004';
const CAT_SEASON = '21000000-0000-4000-8000-000000000005';

const TOP = (n) => `22000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ART = (n) => `23000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function t(text, marks) {
  return { type: 'text', text, ...(marks && marks.length ? { marks } : {}) };
}
function markLink(href) {
  return { type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } };
}

function p(...nodes) {
  return { type: 'paragraph', content: nodes.length ? nodes : [] };
}
function h(level, textStr) {
  return {
    type: 'heading',
    attrs: { level },
    content: [t(textStr)],
  };
}

/**
 * @param {string} slug
 */
function buildDoc(slug) {
  return {
    type: 'doc',
    content: [
      h(2, 'What this guide covers'),
      p(
        t('Home systems run best with a '),
        t('light seasonal rhythm', [{ type: 'bold' }]),
        t('— not a last-minute emergency call. '),
        t('Plan ahead with our checklist', [markLink('https://kingsgate.com')]),
        t('.'),
      ),
      h(3, 'Start here'),
      p(
        t('We recommend a quick walkthrough of the main '),
        t('safety and efficiency', [{ type: 'italic' }]),
        t(' touchpoints in your home.'),
      ),
      {
        type: 'image',
        attrs: {
          src: `https://picsum.photos/seed/${encodeURIComponent(slug)}/1200/800`,
          title: 'Illustration',
          alt: 'Article',
        },
      },
      {
        type: 'blockquote',
        content: [p(
          t('I wish I had done this in October instead of the first cold snap.'),
        )],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [p(t('Check filters and intakes for dust buildup.'))],
          },
          {
            type: 'listItem',
            content: [p(t('Schedule a pro visit before peak season if anything sounds off.'))],
          },
          {
            type: 'listItem',
            content: [p(t('Log model numbers for faster service calls later.'))],
          },
        ],
      },
    ],
  };
}

const YT1 = 'https://www.youtube.com/watch?v=ysz5S6PUM-U';
const YT2 = 'https://www.youtube.com/watch?v=9bZkp7q19f0';

/** @param {Date} d @param {number} [days=7] */
function readyBy(d) {
  const t = d.getTime();
  return new Date(t - 7 * 24 * 60 * 60 * 1000);
}

const articles = [
  {
    id: ART(1),
    title: 'The Furnace Tune-Up Checklist Homeowners Still Skip',
    summary:
      'A short annual routine that prevents mid-winter surprises—filters, flue, and what to ask your tech.',
    topicId: TOP(1),
    categoryId: CAT_HVAC,
    status: 'review',
    content: buildDoc('furnace-tune-1'),
    featuredImage: 'https://picsum.photos/seed/furnace-hero-1/1600/900',
    galleryImages: [
      'https://picsum.photos/seed/furnace-g1-1/800/800',
      'https://picsum.photos/seed/furnace-g2-1/800/800',
    ],
    videoUrl: YT1,
    isEditorsChoice: true,
    views: 18230,
    likes: 420,
    commentsCount: 38,
    publishDate: new Date('2026-05-20T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-05-20T12:00:00.000Z')),
    seoScore: 78,
    wordpressPostId: null,
  },
  {
    id: ART(2),
    title: 'AC Coils, Filters, and the One Mistake That Doubles Your Bill',
    summary:
      'How coil cleanliness, MERV level, and airflow balance work together in summer.',
    topicId: TOP(2),
    categoryId: CAT_HVAC,
    status: 'writing',
    content: buildDoc('ac-mist-2'),
    featuredImage: 'https://picsum.photos/seed/ac-hero-2/1600/900',
    galleryImages: ['https://picsum.photos/seed/ac-g-2/800/800'],
    videoUrl: null,
    isEditorsChoice: false,
    views: 9402,
    likes: 201,
    commentsCount: 14,
    publishDate: new Date('2026-06-10T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-06-10T12:00:00.000Z')),
    seoScore: 71,
    wordpressPostId: null,
  },
  {
    id: ART(3),
    title: 'Duct Leaks: How to Tell Before You See Dust Streaks on Ceilings',
    summary: 'Static pressure, room balance, and when duct sealing is worth the cost.',
    topicId: TOP(3),
    categoryId: CAT_HVAC,
    status: 'assets',
    content: buildDoc('duct-leak-3'),
    featuredImage: 'https://picsum.photos/seed/duct-3/1600/900',
    galleryImages: [
      'https://picsum.photos/seed/duct-3a/800/800',
      'https://picsum.photos/seed/duct-3b/800/800',
    ],
    videoUrl: YT2,
    isEditorsChoice: false,
    views: 5621,
    likes: 89,
    commentsCount: 9,
    publishDate: new Date('2026-07-01T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-07-01T12:00:00.000Z')),
    seoScore: 64,
    wordpressPostId: null,
  },
  {
    id: ART(4),
    title: 'Leak Spots: Where Water Hides the Longest Before It Shows on Drywall',
    summary:
      'Bath valves, kitchen shutoffs, and the slow seep you only smell first.',
    topicId: TOP(5),
    categoryId: CAT_PLUMB,
    status: 'planning',
    content: buildDoc('leak-spot-4'),
    featuredImage: 'https://picsum.photos/seed/plumb-4/1600/900',
    galleryImages: ['https://picsum.photos/seed/plumb-4a/800/800'],
    videoUrl: null,
    isEditorsChoice: false,
    views: 3200,
    likes: 55,
    commentsCount: 6,
    publishDate: new Date('2026-08-15T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-08-15T12:00:00.000Z')),
    seoScore: null,
    wordpressPostId: null,
  },
  {
    id: ART(5),
    title: 'When to Flush a Tank Water Heater—And How Often the Manual Lies to You',
    summary:
      'Sediment, anode, and the two signs it is time to stop flushing and start replacing.',
    topicId: TOP(6),
    categoryId: CAT_PLUMB,
    status: 'research',
    content: buildDoc('heater-5'),
    featuredImage: 'https://picsum.photos/seed/heater-5/1600/900',
    galleryImages: [
      'https://picsum.photos/seed/h5a/800/800',
      'https://picsum.photos/seed/h5b/800/800',
    ],
    videoUrl: YT1,
    isEditorsChoice: true,
    views: 12880,
    likes: 310,
    commentsCount: 22,
    publishDate: new Date('2026-04-30T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-04-30T12:00:00.000Z')),
    seoScore: 82,
    wordpressPostId: 21001,
  },
  {
    id: ART(6),
    title: 'GFCI: Where the Code Wants It—And the Two Places DIYers Get It Wrong',
    summary: 'Bath, kitchen, workshop, and outdoor: tripping, loading, and replacement.',
    topicId: TOP(10),
    categoryId: CAT_ELEC,
    status: 'approval',
    content: buildDoc('gfci-6'),
    featuredImage: 'https://picsum.photos/seed/gfci-6/1600/900',
    galleryImages: ['https://picsum.photos/seed/gf6/800/800'],
    videoUrl: null,
    isEditorsChoice: false,
    views: 4100,
    likes: 70,
    commentsCount: 5,
    publishDate: new Date('2026-05-05T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-05-05T12:00:00.000Z')),
    seoScore: 75,
    wordpressPostId: null,
  },
  {
    id: ART(7),
    title: 'Whole-Home Surge Protection: Panel vs. Strip vs. “Good Enough”',
    summary:
      'A plain-English map of which devices actually share the same protection path.',
    topicId: TOP(11),
    categoryId: CAT_ELEC,
    status: 'scheduling',
    content: buildDoc('surge-7'),
    featuredImage: 'https://picsum.photos/seed/surge-7/1600/900',
    galleryImages: [
      'https://picsum.photos/seed/s7a/800/800',
      'https://picsum.photos/seed/s7b/800/800',
    ],
    videoUrl: null,
    isEditorsChoice: false,
    views: 2910,
    likes: 44,
    commentsCount: 3,
    publishDate: new Date('2026-04-25T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-04-25T12:00:00.000Z')),
    seoScore: 69,
    wordpressPostId: null,
  },
  {
    id: ART(8),
    title: 'Smart Schedules: How to Stop Heating an Empty House Without the Family Wars',
    summary:
      'Routines, geofencing, and “boost for one hour” patterns that work in the real world.',
    topicId: TOP(13),
    categoryId: CAT_SMART,
    status: 'publishing',
    content: buildDoc('smart-8'),
    featuredImage: 'https://picsum.photos/seed/smart-8/1600/900',
    galleryImages: ['https://picsum.photos/seed/sm8/800/800'],
    videoUrl: YT2,
    isEditorsChoice: true,
    views: 22400,
    likes: 610,
    commentsCount: 54,
    publishDate: new Date('2026-04-22T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-04-22T12:00:00.000Z')),
    seoScore: 88,
    wordpressPostId: 21099,
  },
  {
    id: ART(9),
    title: 'Hub vs. No Hub: A Simple Test for “Will These Devices Work Together?”',
    summary:
      'Matter, bridges, and the few questions that prevent the sad return pile.',
    topicId: TOP(14),
    categoryId: CAT_SMART,
    status: 'post_publish',
    content: buildDoc('hub-9'),
    featuredImage: 'https://picsum.photos/seed/hub-9/1600/900',
    galleryImages: [
      'https://picsum.photos/seed/h9a/800/800',
      'https://picsum.photos/seed/h9b/800/800',
    ],
    videoUrl: null,
    isEditorsChoice: false,
    views: 15600,
    likes: 290,
    commentsCount: 19,
    publishDate: new Date('2026-04-10T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-04-10T12:00:00.000Z')),
    seoScore: 80,
    wordpressPostId: 20900,
  },
  {
    id: ART(10),
    title: 'Winterize Pipes: The Two-Day Job That Stops a Five-Figure Leak on Vacation',
    summary:
      'Exterior bibs, crawl spaces, and the vacation mode checklist for peace of mind.',
    topicId: TOP(17),
    categoryId: CAT_SEASON,
    status: 'planning',
    content: buildDoc('winter-10'),
    featuredImage: 'https://picsum.photos/seed/wint-10/1600/900',
    galleryImages: ['https://picsum.photos/seed/w10/800/800'],
    videoUrl: null,
    isEditorsChoice: false,
    views: 4205,
    likes: 98,
    commentsCount: 12,
    publishDate: new Date('2026-10-20T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-10-20T12:00:00.000Z')),
    seoScore: null,
    wordpressPostId: null,
  },
  {
    id: ART(11),
    title: 'Gutter, Roof Edge, and Attic: Spring Prep After a Heavy Winter',
    summary:
      'A walk-around pattern that flags roof edge damage before the next storm.',
    topicId: TOP(18),
    categoryId: CAT_SEASON,
    status: 'writing',
    content: buildDoc('spring-11'),
    featuredImage: 'https://picsum.photos/seed/spring-11/1600/900',
    galleryImages: [
      'https://picsum.photos/seed/sp11a/800/800',
      'https://picsum.photos/seed/sp11b/800/800',
    ],
    videoUrl: null,
    isEditorsChoice: false,
    views: 3300,
    likes: 62,
    commentsCount: 4,
    publishDate: new Date('2026-04-12T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-04-12T12:00:00.000Z')),
    seoScore: 66,
    wordpressPostId: null,
  },
  {
    id: ART(12),
    title: 'Ceiling Fan Direction + Window Timing: the Low-Cost Summer Pairing',
    summary:
      'When cross-vent actually wins over AC—and the humidity signal to watch for.',
    topicId: TOP(19),
    categoryId: CAT_SEASON,
    status: 'assets',
    content: buildDoc('summer-12'),
    featuredImage: 'https://picsum.photos/seed/summer-12/1600/900',
    galleryImages: ['https://picsum.photos/seed/s12/800/800'],
    videoUrl: null,
    isEditorsChoice: false,
    views: 5120,
    likes: 120,
    commentsCount: 11,
    publishDate: new Date('2026-07-20T12:00:00.000Z'),
    readinessDeadline: readyBy(new Date('2026-07-20T12:00:00.000Z')),
    seoScore: 70,
    wordpressPostId: null,
  },
];

module.exports = { articles };
