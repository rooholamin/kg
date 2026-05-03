import { prisma } from '@/lib/prisma';
import { contentLog } from '@/services/content-log.service';

function clampProgress(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function parseDateOnlyToUtcNoon(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(
    Date.UTC(
      Number.parseInt(m[1], 10),
      Number.parseInt(m[2], 10) - 1,
      Number.parseInt(m[3], 10),
      12,
      0,
      0,
      0,
    ),
  );
}

function deriveMilestoneStatus(progressPercent, status) {
  if (status === 'blocked') return 'blocked';
  if (progressPercent >= 100) return 'completed';
  if (progressPercent <= 0) return 'not_started';
  return status === 'completed' ? 'in_progress' : status;
}

function formatValue(value) {
  if (value == null || value === '') return 'none';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value;
  return String(value);
}

function describeChange(label, beforeValue, afterValue) {
  const before = formatValue(beforeValue);
  const after = formatValue(afterValue);
  if (before === after) return null;
  return `${label}: ${before} -> ${after}`;
}

function withChangeDetails(baseMessage, changes) {
  const cleaned = changes.filter(Boolean);
  if (!cleaned.length) return baseMessage;
  return `${baseMessage} :: ${cleaned.join(' | ')}`;
}

async function recomputeWorkstream(tx, workstreamId) {
  const workstream = await tx.projectWorkstream.findUnique({
    where: { id: workstreamId },
    include: { milestones: true },
  });
  if (!workstream) return null;

  const total = workstream.milestones.length || 1;
  const progressPercent = Math.round(
    workstream.milestones.reduce((sum, m) => sum + m.progressPercent, 0) / total,
  );

  let status = 'not_started';
  if (workstream.milestones.some((m) => m.status === 'blocked')) status = 'blocked';
  else if (
    workstream.milestones.length > 0 &&
    workstream.milestones.every((m) => m.status === 'completed')
  ) {
    status = 'completed';
  } else if (
    workstream.milestones.some(
      (m) => m.status === 'in_progress' || m.status === 'completed',
    )
  ) {
    status = 'in_progress';
  }

  return tx.projectWorkstream.update({
    where: { id: workstreamId },
    data: { progressPercent, status },
  });
}

async function recomputePhase(tx, phaseId) {
  const phase = await tx.projectPhase.findUnique({
    where: { id: phaseId },
    include: { workstreams: true },
  });
  if (!phase) return null;

  const total = phase.workstreams.length || 1;
  const progressPercent = Math.round(
    phase.workstreams.reduce((sum, ws) => sum + ws.progressPercent, 0) / total,
  );

  return tx.projectPhase.update({
    where: { id: phaseId },
    data: { progressPercent },
  });
}

async function recomputeForWorkstream(tx, workstreamId) {
  const ws = await recomputeWorkstream(tx, workstreamId);
  if (!ws) return null;
  await recomputePhase(tx, ws.phaseId);
  return ws;
}

async function requirePhase(id, tx = prisma) {
  const phase = await tx.projectPhase.findUnique({ where: { id } });
  if (!phase) {
    const error = new Error('Project phase not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  return phase;
}

async function requireWorkstream(id, tx = prisma) {
  const workstream = await tx.projectWorkstream.findUnique({ where: { id } });
  if (!workstream) {
    const error = new Error('Project workstream not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  return workstream;
}

async function requireMilestone(id, tx = prisma) {
  const milestone = await tx.projectMilestone.findUnique({ where: { id } });
  if (!milestone) {
    const error = new Error('Project milestone not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  return milestone;
}

export async function getProjectProgressTree() {
  const [phases, blockers, reports, recentActivity] = await Promise.all([
    prisma.projectPhase.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        workstreams: {
          orderBy: { sortOrder: 'asc' },
          include: {
            milestones: {
              orderBy: { sortOrder: 'asc' },
              include: {
                blockers: {
                  where: { status: 'open' },
                  orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
                },
              },
            },
          },
        },
      },
    }),
    prisma.projectBlocker.findMany({
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
      include: {
        milestone: {
          select: {
            id: true,
            title: true,
            type: true,
            workstream: { select: { id: true, name: true, phaseId: true } },
          },
        },
      },
    }),
    prisma.projectProgressReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.contentLog.findMany({
      where: {
        entityType: {
          startsWith: 'project_',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const normalizedPhases = phases.map((phase) => ({
    ...phase,
    workstreams: phase.workstreams.map((ws) => ({
      ...ws,
      blockerCount: ws.milestones.reduce(
        (sum, ms) => sum + (ms.blockers?.length || 0),
        0,
      ),
    })),
  }));

  return {
    phases: normalizedPhases,
    blockers,
    latestReport: reports[0] ?? null,
    recentReports: reports,
    recentActivity,
  };
}

export async function getBlockers(status) {
  return prisma.projectBlocker.findMany({
    where: status && status !== 'all' ? { status } : undefined,
    orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
    include: {
      milestone: {
        select: {
          id: true,
          title: true,
          type: true,
          workstream: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function getReports(limit = 20) {
  return prisma.projectProgressReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function createPhase(data) {
  const title = normalizeText(data.title);
  if (!title) {
    const error = new Error('Title is required');
    error.code = 'VALIDATION';
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const phase = await tx.projectPhase.create({
      data: {
        slug: data.slug,
        title,
        description: normalizeText(data.description),
        startDate: parseDateOnlyToUtcNoon(data.startDate),
        endDate: parseDateOnlyToUtcNoon(data.endDate),
        sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : 0,
      },
    });
    await contentLog(
      {
        type: 'project',
        message: `Project phase created: ${phase.title}`,
        entityType: 'project_phase',
        entityId: phase.id,
      },
      tx,
    );
    return phase;
  });
}

export async function updatePhase(id, data) {
  await requirePhase(id);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.projectPhase.findUnique({ where: { id } });
    const updated = await tx.projectPhase.update({
      where: { id },
      data: {
        title: normalizeText(data.title) ?? undefined,
        description: data.description !== undefined ? normalizeText(data.description) : undefined,
        startDate: data.startDate !== undefined ? parseDateOnlyToUtcNoon(data.startDate) : undefined,
        endDate: data.endDate !== undefined ? parseDateOnlyToUtcNoon(data.endDate) : undefined,
        sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : undefined,
      },
    });
    const changes = [
      describeChange('title', existing?.title, updated.title),
      describeChange('start', existing?.startDate, updated.startDate),
      describeChange('end', existing?.endDate, updated.endDate),
    ];
    await contentLog(
      {
        type: 'project',
        message: withChangeDetails(`Project phase updated: ${updated.title}`, changes),
        entityType: 'project_phase',
        entityId: updated.id,
      },
      tx,
    );
    return updated;
  });
}

export async function deletePhase(id) {
  await requirePhase(id);
  return prisma.$transaction(async (tx) => {
    await tx.projectPhase.delete({ where: { id } });
    await contentLog(
      {
        type: 'project',
        message: `Project phase deleted`,
        entityType: 'project_phase',
        entityId: id,
      },
      tx,
    );
    return { deleted: true, id };
  });
}

export async function createWorkstream(data) {
  const name = normalizeText(data.name);
  if (!name || !data.phaseId) {
    const error = new Error('Phase and name are required');
    error.code = 'VALIDATION';
    throw error;
  }
  await requirePhase(data.phaseId);

  return prisma.$transaction(async (tx) => {
    const ws = await tx.projectWorkstream.create({
      data: {
        phaseId: data.phaseId,
        name,
        description: normalizeText(data.description),
        sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : 0,
      },
    });
    await recomputePhase(tx, ws.phaseId);
    await contentLog(
      {
        type: 'project',
        message: `Workstream created: ${ws.name}`,
        entityType: 'project_workstream',
        entityId: ws.id,
      },
      tx,
    );
    return ws;
  });
}

export async function updateWorkstream(id, data) {
  const existing = await requireWorkstream(id);
  return prisma.$transaction(async (tx) => {
    const ws = await tx.projectWorkstream.update({
      where: { id },
      data: {
        name: normalizeText(data.name) ?? undefined,
        description: data.description !== undefined ? normalizeText(data.description) : undefined,
        sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : undefined,
      },
    });
    await recomputePhase(tx, existing.phaseId);
    const changes = [
      describeChange('name', existing.name, ws.name),
      describeChange('description', existing.description, ws.description),
      describeChange('sort', existing.sortOrder, ws.sortOrder),
    ];
    await contentLog(
      {
        type: 'project',
        message: withChangeDetails(`Workstream updated: ${ws.name}`, changes),
        entityType: 'project_workstream',
        entityId: ws.id,
      },
      tx,
    );
    return ws;
  });
}

export async function deleteWorkstream(id) {
  const existing = await requireWorkstream(id);
  return prisma.$transaction(async (tx) => {
    await tx.projectWorkstream.delete({ where: { id } });
    await recomputePhase(tx, existing.phaseId);
    await contentLog(
      {
        type: 'project',
        message: 'Workstream deleted',
        entityType: 'project_workstream',
        entityId: id,
      },
      tx,
    );
    return { deleted: true, id };
  });
}

export async function createMilestone(data) {
  const title = normalizeText(data.title);
  if (!data.workstreamId || !title) {
    const error = new Error('Workstream and title are required');
    error.code = 'VALIDATION';
    throw error;
  }
  await requireWorkstream(data.workstreamId);

  const progressPercent = clampProgress(data.progressPercent);
  const status = deriveMilestoneStatus(progressPercent, data.status || 'not_started');

  return prisma.$transaction(async (tx) => {
    const ms = await tx.projectMilestone.create({
      data: {
        workstreamId: data.workstreamId,
        title,
        description: normalizeText(data.description),
        status,
        type: data.type,
        startDate: parseDateOnlyToUtcNoon(data.startDate),
        endDate: parseDateOnlyToUtcNoon(data.endDate),
        progressPercent,
        sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : 0,
      },
    });
    await recomputeForWorkstream(tx, ms.workstreamId);
    await contentLog(
      {
        type: 'project',
        message: `Milestone created: ${ms.title}`,
        entityType: 'project_milestone',
        entityId: ms.id,
      },
      tx,
    );
    return ms;
  });
}

export async function updateMilestone(id, data) {
  const existing = await requireMilestone(id);

  const progressPercent =
    data.progressPercent !== undefined
      ? clampProgress(data.progressPercent)
      : existing.progressPercent;
  const status = deriveMilestoneStatus(
    progressPercent,
    data.status || existing.status,
  );

  return prisma.$transaction(async (tx) => {
    const ms = await tx.projectMilestone.update({
      where: { id },
      data: {
        title: normalizeText(data.title) ?? undefined,
        description: data.description !== undefined ? normalizeText(data.description) : undefined,
        status,
        type: data.type ?? undefined,
        startDate: data.startDate !== undefined ? parseDateOnlyToUtcNoon(data.startDate) : undefined,
        endDate: data.endDate !== undefined ? parseDateOnlyToUtcNoon(data.endDate) : undefined,
        progressPercent,
        sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : undefined,
      },
    });
    await recomputeForWorkstream(tx, ms.workstreamId);
    const changes = [
      describeChange('title', existing.title, ms.title),
      describeChange('status', existing.status, ms.status),
      describeChange('progress', `${existing.progressPercent}%`, `${ms.progressPercent}%`),
      describeChange('type', existing.type, ms.type),
      describeChange('start', existing.startDate, ms.startDate),
      describeChange('end', existing.endDate, ms.endDate),
    ];
    await contentLog(
      {
        type: 'project',
        message: withChangeDetails(`Milestone updated: ${ms.title}`, changes),
        entityType: 'project_milestone',
        entityId: ms.id,
      },
      tx,
    );
    return ms;
  });
}

export async function deleteMilestone(id) {
  const existing = await requireMilestone(id);
  return prisma.$transaction(async (tx) => {
    await tx.projectMilestone.delete({ where: { id } });
    await recomputeForWorkstream(tx, existing.workstreamId);
    await contentLog(
      {
        type: 'project',
        message: 'Milestone deleted',
        entityType: 'project_milestone',
        entityId: id,
      },
      tx,
    );
    return { deleted: true, id };
  });
}

export async function createBlocker(data) {
  const title = normalizeText(data.title);
  if (!title) {
    const error = new Error('Title is required');
    error.code = 'VALIDATION';
    throw error;
  }
  if (data.milestoneId) await requireMilestone(data.milestoneId);

  return prisma.$transaction(async (tx) => {
    const blocker = await tx.projectBlocker.create({
      data: {
        milestoneId: data.milestoneId || null,
        title,
        description: normalizeText(data.description),
        severity: data.severity || 'medium',
        status: data.status || 'open',
        resolvedAt: data.status === 'resolved' ? new Date() : null,
      },
    });
    await contentLog(
      {
        type: 'project',
        message: `Blocker created: ${blocker.title}`,
        entityType: 'project_blocker',
        entityId: blocker.id,
      },
      tx,
    );
    return blocker;
  });
}

export async function updateBlocker(id, data) {
  const existing = await prisma.projectBlocker.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error('Project blocker not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (data.milestoneId) await requireMilestone(data.milestoneId);

  const nextStatus = data.status || existing.status;
  const resolvedAt =
    nextStatus === 'resolved' ? existing.resolvedAt || new Date() : null;

  return prisma.$transaction(async (tx) => {
    const blocker = await tx.projectBlocker.update({
      where: { id },
      data: {
        milestoneId: data.milestoneId !== undefined ? data.milestoneId : undefined,
        title: normalizeText(data.title) ?? undefined,
        description: data.description !== undefined ? normalizeText(data.description) : undefined,
        severity: data.severity || undefined,
        status: nextStatus,
        resolvedAt,
      },
    });
    const changes = [
      describeChange('title', existing.title, blocker.title),
      describeChange('status', existing.status, blocker.status),
      describeChange('severity', existing.severity, blocker.severity),
      describeChange('milestone', existing.milestoneId, blocker.milestoneId),
    ];
    await contentLog(
      {
        type: 'project',
        message: withChangeDetails(`Blocker updated: ${blocker.title}`, changes),
        entityType: 'project_blocker',
        entityId: blocker.id,
      },
      tx,
    );
    return blocker;
  });
}

export async function deleteBlocker(id) {
  const existing = await prisma.projectBlocker.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error('Project blocker not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    await tx.projectBlocker.delete({ where: { id } });
    await contentLog(
      {
        type: 'project',
        message: 'Blocker deleted',
        entityType: 'project_blocker',
        entityId: id,
      },
      tx,
    );
    return { deleted: true, id };
  });
}

async function getPhaseProgressBySlug(slug) {
  const phase = await prisma.projectPhase.findUnique({
    where: { slug },
    select: { progressPercent: true },
  });
  return phase?.progressPercent ?? 0;
}

export async function createReport(data) {
  const title = normalizeText(data.title);
  const summary = normalizeText(data.summary);
  if (!title || !summary) {
    const error = new Error('Title and summary are required');
    error.code = 'VALIDATION';
    throw error;
  }

  const buildProgress =
    data.buildProgress !== undefined
      ? clampProgress(data.buildProgress)
      : await getPhaseProgressBySlug('build');
  const automationProgress =
    data.automationProgress !== undefined
      ? clampProgress(data.automationProgress)
      : await getPhaseProgressBySlug('automation');

  return prisma.$transaction(async (tx) => {
    const report = await tx.projectProgressReport.create({
      data: {
        title,
        summary,
        buildProgress,
        automationProgress,
        keyFocus: normalizeText(data.keyFocus),
        blockersSummary: normalizeText(data.blockersSummary),
      },
    });
    await contentLog(
      {
        type: 'project',
        message: `Progress report created: ${report.title}`,
        entityType: 'project_report',
        entityId: report.id,
      },
      tx,
    );
    return report;
  });
}

export async function deleteReport(id) {
  const existing = await prisma.projectProgressReport.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error('Project report not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    await tx.projectProgressReport.delete({ where: { id } });
    await contentLog(
      {
        type: 'project',
        message: 'Progress report deleted',
        entityType: 'project_report',
        entityId: id,
      },
      tx,
    );
    return { deleted: true, id };
  });
}
