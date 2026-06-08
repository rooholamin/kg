'use client';

import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const STEP_EMOJI = {
  research: '🔍',
  writing: '✍️',
  assets: '🎨',
};

function duration(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  const end = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
  const ms = end - start;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function CompletedList({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
        <span className="text-3xl">📭</span>
        <p className="text-sm font-medium text-muted-foreground">No articles processed yet</p>
        <p className="text-xs text-muted-foreground/70">Start the engine to begin processing.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <ScrollArea className="h-64">
        <div className="space-y-1 pr-3">
          {items.map((log) => {
            const isSuccess = log.status === 'completed';
            const relTime = log.startedAt
              ? formatDistanceToNow(
                  typeof log.startedAt === 'string' ? parseISO(log.startedAt) : log.startedAt,
                  { addSuffix: true },
                )
              : '';
            const dur = duration(log.startedAt, log.completedAt);

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors"
              >
                {/* Status icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {isSuccess ? (
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger>
                        <XCircle className="size-4 text-rose-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-64">
                        <p className="text-xs">{log.error ?? 'Unknown error'}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={log.article?.title}>
                    {log.article?.title ?? 'Unknown article'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {log.article?.category?.name && (
                      <span className="text-[11px] text-muted-foreground">
                        {log.article.category.name}
                      </span>
                    )}
                    {/* Steps completed */}
                    {log.steps?.length > 0 && (
                      <span className="text-[11px] flex gap-0.5">
                        {log.steps.map((s) => STEP_EMOJI[s] ?? s).join(' ')}
                      </span>
                    )}
                    {/* Duration */}
                    {dur && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <Clock className="size-2.5" />
                        {dur}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/50">{relTime}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}
