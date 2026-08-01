import { prisma } from '@/lib/prisma';

/**
 * Appends a new take to a segment's history and points the segment at it.
 *
 * Called for every clip a segment ever gets — the initial shoot, each
 * regeneration, and manually pasted URLs — so a regeneration that comes back
 * worse than what it replaced can always be undone.
 *
 * Returns the created version, or null when there's no clip to record (a
 * failed generation has no URL and isn't worth a history entry).
 */
export async function recordSegmentVersion(segmentId, { videoUrl, duration, higgsfieldJobId, estimatedCost, source = 'generated', note = null } = {}) {
  if (!videoUrl) return null;

  // A URL already somewhere in this segment's history is the same take, not a
  // new one — re-select it instead of listing it twice. Covers restores, an
  // agent handing back an unchanged job, and re-pasting a URL used earlier.
  const existing = await prisma.videoSegmentVersion.findFirst({ where: { segmentId, videoUrl } });
  if (existing) {
    await prisma.videoSegment.update({ where: { id: segmentId }, data: { activeVersionId: existing.id } });
    return existing;
  }

  const last = await prisma.videoSegmentVersion.findFirst({
    where: { segmentId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const version = await prisma.videoSegmentVersion.create({
    data: {
      segmentId,
      version: (last?.version ?? 0) + 1,
      videoUrl,
      duration: duration ?? null,
      higgsfieldJobId: higgsfieldJobId ?? null,
      estimatedCost: estimatedCost ?? null,
      source,
      note,
    },
  });

  await prisma.videoSegment.update({ where: { id: segmentId }, data: { activeVersionId: version.id } });
  return version;
}

/**
 * Makes an existing version the segment's live clip. Purely a pointer move —
 * no version is added, nothing is deleted, so switching back and forth between
 * takes is free and lossless.
 */
export async function restoreSegmentVersion(segmentId, versionId) {
  const version = await prisma.videoSegmentVersion.findUnique({ where: { id: versionId } });
  if (!version || version.segmentId !== segmentId) {
    const err = new Error('Version not found on this segment');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return prisma.videoSegment.update({
    where: { id: segmentId },
    data: {
      videoUrl: version.videoUrl,
      duration: version.duration,
      higgsfieldJobId: version.higgsfieldJobId,
      estimatedCost: version.estimatedCost,
      activeVersionId: version.id,
      status: version.videoUrl ? 'completed' : 'failed',
      errorMessage: null,
    },
  });
}
