import { addHours, parseISO } from 'date-fns';

/** Publish event color from API readinessStatus (computeReadiness). */
function publishColorFromReadiness(readinessStatus) {
  switch (readinessStatus) {
    case 'ok':
      return 'emerald';
    case 'warning':
      return 'amber';
    case 'risk':
      return 'rose';
    default:
      return 'violet';
  }
}

/**
 * Map article list rows to calendar event shapes (EventCalendar, dashboard schedule).
 * Expects `readinessStatus` when available (from /api/calendar).
 * Publish and readiness are separate events unless they share the exact same instant.
 */
export function articleRowsToCalendarEvents(articles) {
  if (!Array.isArray(articles) || articles.length === 0) return [];

  const out = [];
  for (const a of articles) {
    const title = a.title || 'Untitled';
    const readinessStatus = a.readinessStatus ?? null;
    const publish = a.publishDate
      ? parseISO(String(a.publishDate))
      : null;
    const ready = a.readinessDeadline
      ? parseISO(String(a.readinessDeadline))
      : null;

    const sameInstant =
      publish &&
      ready &&
      !Number.isNaN(publish.getTime()) &&
      !Number.isNaN(ready.getTime()) &&
      publish.getTime() === ready.getTime();

    if (publish && !Number.isNaN(publish.getTime())) {
      out.push({
        id: `art-${a.id}-publish`,
        title: `Publish: ${title}`,
        start: publish.toISOString(),
        end: addHours(publish, 1).toISOString(),
        allDay: false,
        color: publishColorFromReadiness(readinessStatus),
        source: 'articles',
        articleId: a.id,
        readinessStatus,
        eventKind: 'publish',
      });
    }

    if (ready && !Number.isNaN(ready.getTime()) && !sameInstant) {
      out.push({
        id: `art-${a.id}-readiness`,
        title: `⚑ Deadline: ${title}`,
        start: ready.toISOString(),
        end: addHours(ready, 1).toISOString(),
        allDay: false,
        color: 'sky',
        source: 'readiness',
        articleId: a.id,
        readinessStatus,
        eventKind: 'deadline',
      });
    }
  }
  return out;
}

export const calendarMockExcludingArticlePlan = (mockEvents) =>
  mockEvents.filter(
    (e) => e.source !== 'articles' && e.source !== 'readiness',
  );

/** Color by slot status for calendar display */
const SLOT_STATUS_COLOR = {
  planned: 'sky',
  sent_to_n8n: 'amber',
  generating: 'violet',
  completed: 'emerald',
  failed: 'rose',
};

/**
 * Map scheduled slots to calendar event shapes.
 * @param {Array<{
 *   id: string;
 *   batchId: string;
 *   articleId?: string | null;
 *   topicId: string;
 *   topicName?: string | null;
 *   scheduledDate: string;
 *   status: string;
 * }>} slots
 */
export function scheduledSlotsToCalendarEvents(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return [];

  return slots.map((slot) => {
    const date = parseISO(String(slot.scheduledDate));
    const label = slot.topicName ? `Planned: ${slot.topicName}` : 'Planned Slot';
    return {
      id: `slot-${slot.id}`,
      title: label,
      start: date.toISOString(),
      end: addHours(date, 1).toISOString(),
      allDay: false,
      color: SLOT_STATUS_COLOR[slot.status] ?? 'sky',
      source: 'scheduler',
      slotId: slot.id,
      batchId: slot.batchId,
      articleId: slot.articleId ?? null,
      slotStatus: slot.status,
    };
  });
}
