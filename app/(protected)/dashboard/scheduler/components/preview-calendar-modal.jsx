'use client';

import { useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  eachDayOfInterval,
} from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Section color palette — up to 10 distinct sections
// ---------------------------------------------------------------------------

const SECTION_COLORS = [
  { bg: 'bg-violet-500', text: 'text-white', dot: 'bg-violet-500', light: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
  { bg: 'bg-sky-500',    text: 'text-white', dot: 'bg-sky-500',    light: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30' },
  { bg: 'bg-amber-500',  text: 'text-white', dot: 'bg-amber-500',  light: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { bg: 'bg-emerald-500',text: 'text-white', dot: 'bg-emerald-500',light: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { bg: 'bg-rose-500',   text: 'text-white', dot: 'bg-rose-500',   light: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
  { bg: 'bg-orange-500', text: 'text-white', dot: 'bg-orange-500', light: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30' },
  { bg: 'bg-teal-500',   text: 'text-white', dot: 'bg-teal-500',   light: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30' },
  { bg: 'bg-pink-500',   text: 'text-white', dot: 'bg-pink-500',   light: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30' },
  { bg: 'bg-indigo-500', text: 'text-white', dot: 'bg-indigo-500', light: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' },
  { bg: 'bg-lime-500',   text: 'text-black', dot: 'bg-lime-500',   light: 'bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/30' },
];

const FALLBACK_COLOR = { bg: 'bg-muted', text: 'text-foreground', dot: 'bg-muted-foreground', light: 'bg-muted text-muted-foreground border-border' };

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSectionColorMap(slots) {
  const ids = [...new Set(slots.map((s) => s.sectionId).filter(Boolean))];
  // slots without a sectionId get bucketed under null
  if (slots.some((s) => !s.sectionId)) ids.push(null);
  return Object.fromEntries(
    ids.map((id, i) => [String(id), SECTION_COLORS[i % SECTION_COLORS.length]]),
  );
}

function buildCalendarWeeks(startDateStr, endDateStr) {
  const rangeStart = startOfDay(parseISO(startDateStr));
  const rangeEnd   = startOfDay(parseISO(endDateStr));
  const calStart   = startOfWeek(rangeStart, { weekStartsOn: 0 });
  const calEnd     = endOfWeek(rangeEnd, { weekStartsOn: 0 });

  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const weeks = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }
  return { weeks, rangeStart, rangeEnd };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   slots: Array<{ sectionId: string|null; sectionName: string|null; categoryName: string|null; topicName: string|null; scheduledDate: string }>;
 *   total: number;
 *   startDate: string;
 *   endDate: string;
 *   batchName: string;
 *   onConfirm: () => void;
 *   isConfirming: boolean;
 *   confirmError?: string | null;
 * }} props
 */
export function PreviewCalendarModal({
  open,
  onClose,
  slots = [],
  total,
  startDate,
  endDate,
  batchName,
  onConfirm,
  isConfirming,
  confirmError,
}) {
  const sectionColorMap = useMemo(() => buildSectionColorMap(slots), [slots]);

  const { weeks, rangeStart, rangeEnd } = useMemo(() => {
    if (!startDate || !endDate) return { weeks: [], rangeStart: null, rangeEnd: null };
    return buildCalendarWeeks(startDate, endDate);
  }, [startDate, endDate]);

  // Group slots by date string (yyyy-MM-dd)
  const slotsByDate = useMemo(() => {
    const map = {};
    for (const slot of slots) {
      const key = format(new Date(slot.scheduledDate), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(slot);
    }
    return map;
  }, [slots]);

  // Build legend from unique sections, including per-section slot count
  const legend = useMemo(() => {
    const seen = new Map();
    for (const slot of slots) {
      const key = String(slot.sectionId);
      if (!seen.has(key)) {
        seen.set(key, {
          id: slot.sectionId,
          name: slot.sectionName ?? 'No Section',
          color: sectionColorMap[key] ?? FALLBACK_COLOR,
          count: 0,
        });
      }
      seen.get(key).count += 1;
    }
    return [...seen.values()];
  }, [slots, sectionColorMap]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-base">
            Schedule Preview
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {total} slot{total !== 1 ? 's' : ''} · {startDate && endDate ? `${format(parseISO(startDate), 'MMM d')} – ${format(parseISO(endDate), 'MMM d, yyyy')}` : ''}
            </span>
          </DialogTitle>

          {/* Legend */}
          {legend.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {legend.map((l) => (
                <span
                  key={String(l.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
                    l.color.light,
                  )}
                >
                  <span className={cn('size-2 rounded-full shrink-0', l.color.dot)} />
                  {l.name}
                  <span className="opacity-60">{l.count}</span>
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Calendar grid */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {weeks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No date range selected.</p>
            ) : (
              <div className="w-full">
                {/* Weeks grouped by month */}
                <div className="space-y-6">
                  {(() => {
                    // Group consecutive weeks by the month of their first in-range day (or first day).
                    const groups = [];
                    for (const week of weeks) {
                      const anchor =
                        week.find((d) => rangeStart && rangeEnd && isWithinInterval(d, { start: rangeStart, end: rangeEnd })) ??
                        week[0];
                      const monthKey = format(anchor, 'yyyy-MM');
                      if (!groups.length || groups[groups.length - 1].monthKey !== monthKey) {
                        groups.push({ monthKey, label: format(anchor, 'MMMM yyyy'), weeks: [] });
                      }
                      groups[groups.length - 1].weeks.push(week);
                    }

                    return groups.map((group) => (
                      <div key={group.monthKey}>
                        {/* Month header */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-semibold text-foreground">{group.label}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>

                        {/* Day-of-week headers */}
                        <div className="grid grid-cols-7 mb-1">
                          {WEEK_DAYS.map((d) => (
                            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                              {d}
                            </div>
                          ))}
                        </div>

                        {/* Weeks for this month */}
                        <div className="space-y-1">
                          {group.weeks.map((week, wi) => (
                            <div key={wi} className="grid grid-cols-7 gap-1">
                              {week.map((day) => {
                                const inRange =
                                  rangeStart && rangeEnd
                                    ? isWithinInterval(day, { start: rangeStart, end: rangeEnd })
                                    : false;
                                const dateKey = format(day, 'yyyy-MM-dd');
                                const daySlots = slotsByDate[dateKey] ?? [];
                                const isToday = isSameDay(day, new Date());

                                return (
                                  <div
                                    key={dateKey}
                                    className={cn(
                                      'min-h-[72px] rounded-lg border p-1.5 transition-colors',
                                      inRange ? 'border-border bg-card' : 'border-transparent bg-muted/20',
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        'text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full',
                                        isToday
                                          ? 'bg-primary text-primary-foreground'
                                          : inRange
                                            ? 'text-foreground'
                                            : 'text-muted-foreground/40',
                                      )}
                                    >
                                      {format(day, 'd')}
                                    </div>

                                    {daySlots.length > 0 && (
                                      <div className="space-y-0.5">
                                        {daySlots.slice(0, 4).map((slot, si) => {
                                          const color = sectionColorMap[String(slot.sectionId)] ?? FALLBACK_COLOR;
                                          return (
                                            <div
                                              key={si}
                                              title={[slot.sectionName, slot.categoryName, slot.topicName]
                                                .filter(Boolean)
                                                .join(' › ')}
                                              className={cn(
                                                'truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium border cursor-default',
                                                color.light,
                                              )}
                                            >
                                              {slot.topicName ?? slot.categoryName ?? '—'}
                                            </div>
                                          );
                                        })}
                                        {daySlots.length > 4 && (
                                          <div className="text-[10px] text-muted-foreground px-1">
                                            +{daySlots.length - 4} more
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex-col sm:flex-row gap-2">
          {confirmError && (
            <p className="text-xs text-destructive mr-auto">{confirmError}</p>
          )}
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isConfirming || !batchName?.trim() || total === 0}
          >
            {isConfirming && <RefreshCw className="size-4 mr-2 animate-spin" />}
            {isConfirming ? 'Creating batch…' : `Confirm & Create ${total} Slot${total !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
