const PHASE_BUILD = '51000000-0000-4000-8000-000000000001';
const PHASE_AUTOMATION = '51000000-0000-4000-8000-000000000002';

const WS_BUILD = '52000000-0000-4000-8000-000000000001';
const WS_ARTICLE_AUTOMATION = '52000000-0000-4000-8000-000000000002';
const WS_IMAGE_AUTOMATION = '52000000-0000-4000-8000-000000000003';
const WS_SEO_AUTOMATION = '52000000-0000-4000-8000-000000000004';
const WS_SOCIAL_AUTOMATION = '52000000-0000-4000-8000-000000000005';
const WS_PUBLISH_AUTOMATION = '52000000-0000-4000-8000-000000000006';
const WS_QA_AUTOMATION = '52000000-0000-4000-8000-000000000007';

const MS = (n) => `53000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BL = (n) => `54000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const RP = (n) => `55000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const dayMs = 86400000;
const projectStart = new Date(Date.UTC(2026, 3, 23, 12, 0, 0, 0)); // 2026-04-23
const addDays = (base, days) => new Date(base.getTime() + days * dayMs);
const buildStart = projectStart;
const buildEnd = addDays(buildStart, 14); // 2 weeks
const automationStart = buildEnd;
const automationEnd = addDays(automationStart, 42); // 6 weeks

const phases = [
  {
    id: PHASE_BUILD,
    slug: 'build',
    title: 'System Build',
    description:
      'Core system delivery: dashboard, backend, content engine, and base integrations.',
    startDate: buildStart,
    endDate: buildEnd,
    progressPercent: 0,
    sortOrder: 0,
  },
  {
    id: PHASE_AUTOMATION,
    slug: 'automation',
    title: 'Automation & Calibration',
    description:
      'n8n workflow design, test loops, AI calibration, and operational stabilization.',
    startDate: automationStart,
    endDate: automationEnd,
    progressPercent: 0,
    sortOrder: 1,
  },
];

const workstreams = [
  {
    id: WS_BUILD,
    phaseId: PHASE_BUILD,
    name: 'System Build',
    description: 'Milestones 1-10 implementation track.',
    status: 'in_progress',
    progressPercent: 0,
    sortOrder: 0,
  },
  {
    id: '52000000-0000-4000-8000-000000000008',
    phaseId: PHASE_BUILD,
    name: 'WordPress site',
    description: 'WordPress theme and publishing destination readiness.',
    status: 'in_progress',
    progressPercent: 0,
    sortOrder: 1,
  },
  {
    id: WS_ARTICLE_AUTOMATION,
    phaseId: PHASE_AUTOMATION,
    name: 'Article generation automation',
    description: 'Prompt-to-draft pipeline generation with feedback loops.',
    status: 'not_started',
    progressPercent: 0,
    sortOrder: 0,
  },
  {
    id: WS_IMAGE_AUTOMATION,
    phaseId: PHASE_AUTOMATION,
    name: 'Image generation workflow',
    description: 'Asset generation and publishing-ready image QA flow.',
    status: 'not_started',
    progressPercent: 0,
    sortOrder: 1,
  },
  {
    id: WS_SEO_AUTOMATION,
    phaseId: PHASE_AUTOMATION,
    name: 'SEO linking automation',
    description: 'Internal/external linking and SEO consistency checks.',
    status: 'not_started',
    progressPercent: 0,
    sortOrder: 2,
  },
  {
    id: WS_SOCIAL_AUTOMATION,
    phaseId: PHASE_AUTOMATION,
    name: 'Social content automation',
    description: 'Post-generate and cross-platform adaptation workflow.',
    status: 'not_started',
    progressPercent: 0,
    sortOrder: 3,
  },
  {
    id: WS_PUBLISH_AUTOMATION,
    phaseId: PHASE_AUTOMATION,
    name: 'Publishing automation',
    description: 'Approval-to-publish handoff and resilient publication jobs.',
    status: 'not_started',
    progressPercent: 0,
    sortOrder: 4,
  },
  {
    id: WS_QA_AUTOMATION,
    phaseId: PHASE_AUTOMATION,
    name: 'QA + edge case handling',
    description: 'Regression guardrails, retries, and failure-class coverage.',
    status: 'not_started',
    progressPercent: 0,
    sortOrder: 5,
  },
];

const buildMilestoneTitles = [
  'Metronic setup',
  'Dashboard UI',
  'Backend',
  'Categories/Topics',
  'Articles',
  'Project Progress',
  'Calendar',
  'Logs',
  'WordPress integration',
  'AI integration',
];

const buildMilestoneProgress = [100, 100, 100, 100, 100, 100, 100, 10, 0, 0];

const milestones = [
  ...buildMilestoneTitles.map((title, index) => {
    const progressPercent = buildMilestoneProgress[index];
    return {
      id: MS(index + 1),
      workstreamId: WS_BUILD,
      title,
      description: `Milestone ${index + 1} execution in the build phase.`,
      status:
        progressPercent === 100
          ? 'completed'
          : progressPercent > 0
            ? 'in_progress'
            : 'not_started',
      type: 'build',
      startDate: addDays(buildStart, index),
      endDate: addDays(buildStart, Math.min(index + 1, 14)),
      progressPercent,
      sortOrder: index,
    };
  }),
  {
    id: MS(41),
    workstreamId: '52000000-0000-4000-8000-000000000008',
    title: 'WordPress infrastructure setup',
    description: 'Provision WordPress environment and baseline plugins.',
    status: 'completed',
    type: 'build',
    startDate: addDays(buildStart, 1),
    endDate: addDays(buildStart, 4),
    progressPercent: 100,
    sortOrder: 0,
  },
  {
    id: MS(42),
    workstreamId: '52000000-0000-4000-8000-000000000008',
    title: 'Theme setup and content model mapping',
    description: 'Map dashboard article model to WordPress structure.',
    status: 'in_progress',
    type: 'build',
    startDate: addDays(buildStart, 5),
    endDate: addDays(buildStart, 10),
    progressPercent: 60,
    sortOrder: 1,
  },
  {
    id: MS(43),
    workstreamId: '52000000-0000-4000-8000-000000000008',
    title: 'Publishing flow verification',
    description: 'Validate end-to-end publish handoff from dashboard to WordPress.',
    status: 'not_started',
    type: 'build',
    startDate: addDays(buildStart, 11),
    endDate: buildEnd,
    progressPercent: 0,
    sortOrder: 2,
  },
];

const automationWorkstreamSpecs = [
  {
    ws: WS_ARTICLE_AUTOMATION,
    title: 'Article generation automation',
    startDay: 0,
    detailedDescription: 'Automated article generation pipeline.',
  },
  {
    ws: WS_IMAGE_AUTOMATION,
    title: 'Image generation workflow',
    startDay: 5,
    detailedDescription: 'Image workflow orchestration and QA.',
  },
  {
    ws: WS_SEO_AUTOMATION,
    title: 'SEO linking automation',
    startDay: 10,
    detailedDescription: 'SEO checks and linking automation.',
  },
  {
    ws: WS_SOCIAL_AUTOMATION,
    title: 'Social content automation',
    startDay: 15,
    detailedDescription: 'Social repurposing automation.',
  },
  {
    ws: WS_PUBLISH_AUTOMATION,
    title: 'Publishing automation',
    startDay: 20,
    detailedDescription: 'Publishing pipeline automation.',
  },
  {
    ws: WS_QA_AUTOMATION,
    title: 'QA + edge case handling',
    startDay: 25,
    detailedDescription: 'Resilience and edge case handling.',
  },
];

const automationStepTemplates = [
  { key: 'design workflow', progressPercent: 20, status: 'in_progress' },
  { key: 'implement in n8n', progressPercent: 0, status: 'not_started' },
  { key: 'test', progressPercent: 0, status: 'not_started' },
  { key: 'calibrate', progressPercent: 0, status: 'not_started' },
  { key: 'stabilize', progressPercent: 0, status: 'not_started' },
];

automationWorkstreamSpecs.forEach((spec, wsIndex) => {
  automationStepTemplates.forEach((step, stepIndex) => {
    const idNum = 11 + wsIndex * automationStepTemplates.length + stepIndex;
    milestones.push({
      id: MS(idNum),
      workstreamId: spec.ws,
      title: `${spec.title} — ${step.key}`,
      description: `${spec.detailedDescription} (${step.key}).`,
      status: wsIndex === 0 ? step.status : 'not_started',
      type: 'automation',
      startDate: addDays(automationStart, spec.startDay + stepIndex * 4),
      endDate: addDays(automationStart, spec.startDay + stepIndex * 4 + 3),
      progressPercent: wsIndex === 0 ? step.progressPercent : 0,
      sortOrder: stepIndex,
    });
  });
});

const blockers = [
  {
    id: BL(1),
    milestoneId: MS(14),
    title: 'n8n credentials provisioning pending',
    description:
      'Shared secrets for external APIs are not available in staging, blocking automation implementation.',
    severity: 'high',
    status: 'open',
    createdAt: addDays(buildEnd, -1),
    resolvedAt: null,
  },
  {
    id: BL(2),
    milestoneId: MS(24),
    title: 'Calibration drift on AI image consistency',
    description:
      'Generated asset style drifts between batches and fails brand constraints.',
    severity: 'critical',
    status: 'open',
    createdAt: addDays(buildEnd, 0),
    resolvedAt: null,
  },
  {
    id: BL(3),
    milestoneId: MS(7),
    title: 'Calendar readiness edge cases not finalized',
    description:
      'Readiness edge cases around timezone boundaries still need implementation.',
    severity: 'medium',
    status: 'resolved',
    createdAt: addDays(buildStart, 6),
    resolvedAt: addDays(buildEnd, 0),
  },
];

const reports = [
  {
    id: RP(1),
    title: 'Milestone 5 kickoff snapshot',
    summary:
      'System build is mostly complete; automation kickoff has started with workflow design and calibration prep.',
    buildProgress: 75,
    automationProgress: 5,
    keyFocus: 'Calibrating article generation workflow',
    blockersSummary:
      'Main risks are n8n credential provisioning and image calibration drift.',
    createdAt: addDays(buildEnd, 0),
  },
  {
    id: RP(2),
    title: 'Milestone 6 editorial calendar snapshot',
    summary:
      'Calendar module uses GET /api/calendar with readiness (ok / warning / risk), publish + deadline events, at-risk summary, and article deep links. Social slots remain mock until Milestone 10.',
    buildProgress: 81,
    automationProgress: 5,
    keyFocus: 'Logs + activity tracking (Milestone 7)',
    blockersSummary:
      'n8n credentials and image calibration remain open; calendar blocker MS(7) cleared.',
    createdAt: addDays(buildEnd, 1),
  },
];

module.exports = {
  phases,
  workstreams,
  milestones,
  blockers,
  reports,
};
