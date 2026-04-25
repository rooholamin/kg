import { addHours, parseISO } from 'date-fns';

/**
 * Map article list rows to calendar event shapes (EventCalendar, dashboard schedule).
 * Publish and readiness are separate events unless they share the exact same instant.
 */
export function articleRowsToCalendarEvents(articles) {
  if (!Array.isArray(articles) || articles.length === 0) return [];

  const out = [];
  for (const a of articles) {
    const title = a.title || 'Untitled';
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
        color: 'violet',
        source: 'articles',
        articleId: a.id,
      });
    }

    if (ready && !Number.isNaN(ready.getTime()) && !sameInstant) {
      out.push({
        id: `art-${a.id}-readiness`,
        title: `Readiness: ${title}`,
        start: ready.toISOString(),
        end: addHours(ready, 1).toISOString(),
        allDay: false,
        color: 'rose',
        source: 'readiness',
        articleId: a.id,
      });
    }
  }
  return out;
}

export const calendarMockExcludingArticlePlan = (mockEvents) =>
  mockEvents.filter(
    (e) => e.source !== 'articles' && e.source !== 'readiness',
  );
