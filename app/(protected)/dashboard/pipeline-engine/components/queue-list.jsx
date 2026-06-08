'use client';

import { cn } from '@/lib/utils';
import { format, parseISO, isPast, isWithinInterval, addDays } from 'date-fns';
import { Clock, AlertTriangle, Flame } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const STATUS_COLORS = {
  planning: 'bg-slate-400/15 text-slate-600 dark:text-slate-300',
  research: 'bg-sky-400/15 text-sky-700 dark:text-sky-300',
  writing: 'bg-violet-400/15 text-violet-700 dark:text-violet-300',
  assets: 'bg-amber-400/15 text-amber-700 dark:text-amber-300',
};

const STATUS_LABELS = {
  planning: 'Plan',
  research: 'Research',
  writing: 'Writing',
  assets: 'Assets',
};

function DeadlineBadge({ readinessDeadline }) {
  if (!readinessDeadline) return null;

  const date = typeof readinessDeadline === 'string' ? parseISO(readinessDeadline) : readinessDeadline;
  const now = new Date();
  const isOverdue = isPast(date);
  const isUrgent = !isOverdue && isWithinInterval(date, { start: now, end: addDays(now, 3) });

  if (!isOverdue && !isUrgent) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
        isOverdue
          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      )}
    >
      {isOverdue ? <Flame className="size-2.5" /> : <AlertTriangle className="size-2.5" />}
      {isOverdue ? 'Overdue' : 'Urgent'}
    </span>
  );
}

export function QueueList({ items = [], activeArticleId }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
        <span className="text-3xl">🎉</span>
        <p className="text-sm font-medium text-muted-foreground">Queue is empty!</p>
        <p className="text-xs text-muted-foreground/70">All articles are ready for approval.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-64">
      <div className="space-y-1 pr-3">
        {items.map((article, idx) => {
          const isActive = article.id === activeArticleId;
          return (
            <div
              key={article.id}
              className={cn(
                'flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-all duration-300',
                isActive
                  ? 'border-primary/30 bg-primary/5 shadow-sm'
                  : 'border-transparent hover:border-border hover:bg-muted/30',
              )}
            >
              {/* Position indicator */}
              <div
                className={cn(
                  'flex-shrink-0 flex size-5 items-center justify-center rounded-full text-[10px] font-bold mt-0.5',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {isActive ? '▶' : idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium truncate',
                    isActive ? 'text-foreground' : 'text-foreground/80',
                  )}
                  title={article.title}
                >
                  {article.title}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {article.category?.name && (
                    <span className="text-[11px] text-muted-foreground">{article.category.name}</span>
                  )}
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                      STATUS_COLORS[article.status] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {STATUS_LABELS[article.status] ?? article.status}
                  </span>
                  <DeadlineBadge readinessDeadline={article.readinessDeadline} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
