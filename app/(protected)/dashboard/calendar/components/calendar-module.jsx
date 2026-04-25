'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isSameDay, parseISO } from 'date-fns';
import { EventCalendar } from '@/components/custom/calendar/event-calendar';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { Separator } from '@/components/ui/separator';
import { MOCK_CALENDAR_EVENTS } from '@/app/(protected)/dashboard/_mock';
import {
  articleRowsToCalendarEvents,
  calendarMockExcludingArticlePlan,
} from '@/lib/calendar-article-events';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  Clock,
  FileText,
  Instagram,
  Linkedin,
  Mail,
  Twitter,
  Youtube,
} from 'lucide-react';

const sourceColorMap = {
  articles: 'after:bg-violet-500',
  readiness: 'after:bg-rose-500',
  instagram: 'after:bg-amber-500',
  x: 'after:bg-sky-500',
  youtube: 'after:bg-emerald-500',
  linkedin: 'after:bg-blue-500',
  newsletter: 'after:bg-orange-500',
};

const menuItems = [
  { id: 'all', label: 'All', icon: <CalendarIcon className="w-4 h-4" />, color: 'text-blue-400' },
  { id: 'articles', label: 'Articles', icon: <FileText className="w-4 h-4" />, color: 'text-violet-400' },
  { id: 'readiness', label: 'Readiness', icon: <Clock className="w-4 h-4" />, color: 'text-rose-400' },
  { id: 'instagram', label: 'Instagram', icon: <Instagram className="w-4 h-4" />, color: 'text-amber-400' },
  { id: 'x', label: 'X / Twitter', icon: <Twitter className="w-4 h-4" />, color: 'text-sky-400' },
  { id: 'youtube', label: 'YouTube', icon: <Youtube className="w-4 h-4" />, color: 'text-emerald-400' },
  { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="w-4 h-4" />, color: 'text-blue-400' },
  { id: 'newsletter', label: 'Newsletter', icon: <Mail className="w-4 h-4" />, color: 'text-orange-400' },
];

async function fetchAllArticles() {
  const r = await apiFetch('/api/articles');
  if (!r.ok) throw new Error('Failed to load articles');
  const j = await r.json();
  return j.data ?? [];
}

export function CalendarModule() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [source, setSource] = useState('all');

  const { data: articleRows = [] } = useQuery({
    queryKey: ['articles', 'calendar'],
    queryFn: fetchAllArticles,
  });

  const nonArticleMock = useMemo(
    () => calendarMockExcludingArticlePlan(MOCK_CALENDAR_EVENTS),
    [],
  );
  const articleEvents = useMemo(
    () => articleRowsToCalendarEvents(articleRows),
    [articleRows],
  );

  const allEvents = useMemo(
    () => [...articleEvents, ...nonArticleMock],
    [articleEvents, nonArticleMock],
  );

  const events = useMemo(() => {
    if (source === 'all') return allEvents;
    return allEvents.filter((e) => e.source === source);
  }, [source, allEvents]);

  const selectedDayEvents = useMemo(
    () =>
      events.filter((e) => isSameDay(parseISO(e.start), selectedDate)),
    [events, selectedDate],
  );

  const counts = useMemo(() => {
    const c = { all: allEvents.length };
    allEvents.forEach((e) => {
      c[e.source] = (c[e.source] || 0) + 1;
    });
    return c;
  }, [allEvents]);

  return (
    <Container>
      <MilestoneNote milestone={6}>
        Article publish and readiness dates load from the articles API. Other sources remain mock
        until Milestone 6. Drag/save is visual only.
      </MilestoneNote>

      <div className="mt-4 flex flex-col xl:flex-row gap-5 min-h-0">
        {/* Left sidebar */}
        <div className="xl:w-64 shrink-0 rounded-xl border border-border bg-card overflow-hidden">
          {/* Mini calendar */}
          <div className="px-4 pt-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              className="w-full p-0"
              required
            />
          </div>

          {/* Selected day events */}
          <div className="px-4 pb-4 space-y-2">
            <div className="px-1">
              <span className="text-sm font-medium text-foreground">
                {format(selectedDate, 'MMMM d, yyyy')}
              </span>
            </div>
            {selectedDayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">No events this day</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      'relative rounded-md bg-muted/50 p-2 pl-6 text-sm',
                      'after:absolute after:inset-y-2 after:left-2 after:w-1 after:rounded-full',
                      sourceColorMap[e.source] ?? 'after:bg-muted-foreground',
                    )}
                  >
                    <div className="font-medium text-foreground leading-tight">{e.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(e.start), 'h:mm a')} –{' '}
                      {format(parseISO(e.end), 'h:mm a')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Source filter menu */}
          <div className="px-4 py-4 space-y-3">
            <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-muted-foreground">
              Sources
            </div>
            <div className="space-y-0.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
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
                        source === item.id ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  {counts[item.id] !== undefined && (
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        source === item.id
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {counts[item.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
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
                />
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </Container>
  );
}
