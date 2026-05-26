'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';
import { EventCalendar } from '@/components/custom/calendar/event-calendar';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MOCK_CALENDAR_EVENTS } from '@/app/(protected)/dashboard/_mock';
import {
  articleRowsToCalendarEvents,
  calendarMockExcludingArticlePlan,
  scheduledSlotsToCalendarEvents,
} from '@/lib/calendar-article-events';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  Layers,
  Share2,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react';

const SOCIAL_SOURCES = new Set([
  'instagram',
  'x',
  'youtube',
  'linkedin',
  'newsletter',
]);

/** Sidebar strip color: prefer calendar event `color`, else source */
const eventStripClass = {
  violet: 'after:bg-violet-500',
  emerald: 'after:bg-emerald-500',
  amber: 'after:bg-amber-500',
  rose: 'after:bg-rose-500',
  sky: 'after:bg-sky-500',
  orange: 'after:bg-orange-500',
};

const readinessDot = {
  risk: 'bg-rose-500',
  warning: 'bg-amber-500',
  ok: 'bg-emerald-500',
  neutral: 'bg-muted-foreground/40',
};

const menuItems = [
  {
    id: 'all',
    label: 'All',
    icon: <CalendarIcon className="w-4 h-4" />,
    color: 'text-blue-400',
  },
  {
    id: 'content',
    label: 'Content',
    icon: <Layers className="w-4 h-4" />,
    color: 'text-violet-400',
  },
  {
    id: 'scheduler',
    label: 'Scheduler',
    icon: <CalendarClock className="w-4 h-4" />,
    color: 'text-sky-400',
  },
  {
    id: 'social',
    label: 'Social',
    icon: <Share2 className="w-4 h-4" />,
    color: 'text-amber-400',
  },
];

async function fetchCalendarData() {
  const r = await apiFetch('/api/calendar?includeSlots=true');
  if (!r.ok) throw new Error('Failed to load calendar');
  const j = await r.json();
  return { articles: j.data ?? [], slots: j.slots ?? [] };
}

export function CalendarModule() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [source, setSource] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const { data: calendarData = { articles: [], slots: [] } } = useQuery({
    queryKey: ['calendar', 'articles'],
    queryFn: fetchCalendarData,
  });

  const articleRows = calendarData.articles;
  const slotRows = calendarData.slots;

  const riskCount = useMemo(
    () => articleRows.filter((a) => a.readinessStatus === 'risk').length,
    [articleRows],
  );

  const nonArticleMock = useMemo(
    () => calendarMockExcludingArticlePlan(MOCK_CALENDAR_EVENTS),
    [],
  );

  const articleEvents = useMemo(
    () => articleRowsToCalendarEvents(articleRows),
    [articleRows],
  );

  const slotEvents = useMemo(
    () => scheduledSlotsToCalendarEvents(slotRows),
    [slotRows],
  );

  const allEvents = useMemo(
    () => [...articleEvents, ...slotEvents, ...nonArticleMock],
    [articleEvents, slotEvents, nonArticleMock],
  );

  const events = useMemo(() => {
    let list = allEvents;
    if (source === 'content') {
      list = list.filter(
        (e) => e.source === 'articles' || e.source === 'readiness',
      );
    } else if (source === 'scheduler') {
      list = list.filter((e) => e.source === 'scheduler');
    } else if (source === 'social') {
      list = list.filter((e) => SOCIAL_SOURCES.has(e.source));
    }
    if (riskFilter === 'risk') {
      list = list.filter((e) => e.readinessStatus === 'risk');
    } else if (riskFilter === 'warning') {
      list = list.filter((e) => e.readinessStatus === 'warning');
    }
    return list;
  }, [source, riskFilter, allEvents]);

  const selectedDayEvents = useMemo(
    () => events.filter((e) => isSameDay(parseISO(e.start), selectedDate)),
    [events, selectedDate],
  );

  const counts = useMemo(() => {
    return {
      all: allEvents.length,
      content: articleEvents.length,
      scheduler: slotEvents.length,
      social: nonArticleMock.length,
    };
  }, [allEvents.length, articleEvents.length, slotEvents.length, nonArticleMock.length]);

  const upcomingArticles = useMemo(() => {
    const now = startOfDay(new Date());
    const end = addDays(now, 14);
    return articleRows
      .filter((a) => {
        if (!a.publishDate) return false;
        const p = parseISO(String(a.publishDate));
        if (Number.isNaN(p.getTime())) return false;
        const p0 = startOfDay(p);
        return p0 >= now && p0 <= end;
      })
      .sort(
        (a, b) =>
          new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime(),
      )
      .slice(0, 24);
  }, [articleRows]);

  const stripForEvent = (e) =>
    eventStripClass[e.color] ?? 'after:bg-muted-foreground';

  const dotForReadiness = (status) => {
    if (status === 'risk') return readinessDot.risk;
    if (status === 'warning') return readinessDot.warning;
    if (status === 'ok') return readinessDot.ok;
    return readinessDot.neutral;
  };

  return (
    <Container>
      <MilestoneNote milestone={6}>
        Article publish dates and readiness load from <code className="text-xs">/api/calendar</code>.
        Social slots use mock events until Milestone 10. Drag/save is visual only.
      </MilestoneNote>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardHeader className="pb-2 pt-4 px-4 sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <CardTitle className="text-base font-semibold">
                  At risk
                </CardTitle>
                <Badge variant="destructive" className="tabular-nums">
                  {riskCount}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  article{riskCount === 1 ? '' : 's'} past readiness deadline
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={riskFilter === 'risk' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setRiskFilter((f) => (f === 'risk' ? 'all' : 'risk'))
                  }
                >
                  Show only risk
                </Button>
                <Button
                  type="button"
                  variant={riskFilter === 'warning' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setRiskFilter((f) => (f === 'warning' ? 'all' : 'warning'))
                  }
                >
                  Show only warning
                </Button>
                {riskFilter !== 'all' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRiskFilter('all')}
                  >
                    Clear filter
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="flex flex-col xl:flex-row gap-5 min-h-0">
          {/* Left sidebar */}
          <div className="xl:w-72 shrink-0 rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 pt-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="w-full p-0"
                required
              />
            </div>

            <div className="px-4 pb-4 space-y-2">
              <div className="px-1">
                <span className="text-sm font-medium text-foreground">
                  {format(selectedDate, 'MMMM d, yyyy')}
                </span>
              </div>
              {selectedDayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">
                  No events this day
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedDayEvents.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => {
                        if (e.source === 'scheduler') {
                          if (e.articleId) {
                            router.push(`/dashboard/articles/${e.articleId}`);
                          } else if (e.batchId) {
                            router.push(`/dashboard/scheduler/${e.batchId}`);
                          }
                        } else if (e.articleId) {
                          router.push(`/dashboard/articles/${e.articleId}`);
                        }
                      }}
                      disabled={!e.articleId && !e.batchId}
                      className={cn(
                        'relative w-full text-left rounded-md bg-muted/50 p-2 pl-6 text-sm',
                        'after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full',
                        stripForEvent(e),
                        (e.articleId || e.batchId) &&
                          'cursor-pointer hover:bg-muted/80 transition-colors',
                        !e.articleId && !e.batchId && 'opacity-80 cursor-default',
                      )}
                    >
                      <div className="font-medium text-foreground leading-tight">
                        {e.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(e.start), 'h:mm a')} –{' '}
                        {format(parseISO(e.end), 'h:mm a')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="px-4 py-3 space-y-2">
              <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-muted-foreground">
                Upcoming (14 days)
              </div>
              {upcomingArticles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No scheduled publishes in the next two weeks.
                </p>
              ) : (
                <ul className="space-y-2 max-h-52 overflow-y-auto text-sm">
                  {upcomingArticles.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/dashboard/articles/${a.id}`)
                        }
                        className="w-full flex items-start gap-2 text-left rounded-md px-1 py-1 hover:bg-accent/60 transition-colors"
                      >
                        <span
                          className={cn(
                            'mt-1.5 size-2 shrink-0 rounded-full',
                            dotForReadiness(a.readinessStatus),
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-foreground line-clamp-2">
                            {a.title}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {a.publishDate
                              ? format(
                                  parseISO(String(a.publishDate)),
                                  'MMM d, yyyy',
                                )
                              : '—'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            <div className="px-4 py-4 space-y-3">
              <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-muted-foreground">
                Sources
              </div>
              <div className="space-y-0.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSource(item.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-all',
                      'hover:bg-accent active:scale-[0.98]',
                      source === item.id ? 'bg-accent' : 'bg-transparent',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex items-center justify-center size-7 rounded-md',
                          source === item.id ? 'bg-background' : 'bg-muted',
                        )}
                      >
                        <span className={item.color}>{item.icon}</span>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          source === item.id
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {item.label}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        source === item.id
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {counts[item.id] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 pb-4">
              <MilestoneNote milestone={10} className="text-xs">
                The Social source shows placeholder events only. Real channel
                scheduling ships in Milestone 10.
              </MilestoneNote>
            </div>
          </div>

          {/* Main calendar */}
          <div className="flex-1 min-w-0">
            <Card className="h-full">
              <CardContent className="p-2 sm:p-3 overflow-x-auto">
                <div className="min-h-[560px] rounded-md">
                  <EventCalendar
                    events={events}
                    initialView="month"
                    showNewEvent={false}
                    onEventAdd={() => {}}
                    onEventUpdate={() => {}}
                    onEventDelete={() => {}}
                    onEventClick={(ev) => {
                      if (ev.source === 'scheduler') {
                        if (ev.articleId) {
                          router.push(`/dashboard/articles/${ev.articleId}`);
                        } else if (ev.batchId) {
                          router.push(`/dashboard/scheduler/${ev.batchId}`);
                        }
                      } else if (ev.articleId) {
                        router.push(`/dashboard/articles/${ev.articleId}`);
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Container>
  );
}
