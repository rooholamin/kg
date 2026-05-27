'use client';

import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import {
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ExternalLink,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { N8nStatusBadge } from '../../components/n8n-status-badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Typewriter hook
// ---------------------------------------------------------------------------

function useTypewriter(text, speed = 20) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(true); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { setDone(true); clearInterval(timer); }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayed, done };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CFG = {
  planned:    { label: 'Planned',    dot: 'bg-sky-400',     text: 'text-sky-600 dark:text-sky-400',     ring: 'ring-sky-400/30' },
  sent_to_n8n:{ label: 'Queued',     dot: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-400/30', pulse: true },
  generating: { label: 'Generating', dot: 'bg-violet-400',  text: 'text-violet-600 dark:text-violet-400',ring: 'ring-violet-400/30', pulse: true },
  completed:  { label: 'Done',       dot: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-400/30' },
  failed:     { label: 'Failed',     dot: 'bg-rose-400',    text: 'text-rose-600 dark:text-rose-400',   ring: 'ring-rose-400/30' },
};

const BATCH_STATUS_CFG = {
  draft:     'text-muted-foreground',
  scheduled: 'text-sky-600 dark:text-sky-400',
  running:   'text-violet-600 dark:text-violet-400',
  paused:    'text-amber-600 dark:text-amber-400',
  completed: 'text-emerald-600 dark:text-emerald-400',
  failed:    'text-rose-600 dark:text-rose-400',
};

function formatDuration(startedAt, completedAt) {
  if (!startedAt) return null;
  const secs = differenceInSeconds(
    completedAt ? new Date(completedAt) : new Date(),
    new Date(startedAt),
  );
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function slotDuration(triggeredAt, completedAt) {
  if (!triggeredAt || !completedAt) return null;
  return differenceInSeconds(new Date(completedAt), new Date(triggeredAt));
}

async function fetchBatchDetail(id) {
  const res = await apiFetch(`/api/scheduler/batches/${id}`);
  if (!res.ok) throw new Error('Failed to load batch');
  return (await res.json()).data;
}

// ---------------------------------------------------------------------------
// Slot Card
// ---------------------------------------------------------------------------

const SlotCard = forwardRef(function SlotCard({ slot, animateTitle, onRedo, onRetry, isRedoing, isRetrying, n8nAvailable }, ref) {
  const cfg = STATUS_CFG[slot.status] ?? { label: slot.status, dot: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-border' };
  const isActive = slot.status === 'sent_to_n8n' || slot.status === 'generating';
  const isCompleted = slot.status === 'completed';
  const isFailed = slot.status === 'failed';
  const dur = slotDuration(slot.triggeredAt, slot.completedAt);
  const articleTitle = slot.planningData?.title ?? null;
  const [expanded, setExpanded] = useState(false);

  const { displayed, done } = useTypewriter(
    animateTitle && articleTitle ? articleTitle : null,
    18,
  );

  const shownTitle = animateTitle && articleTitle
    ? displayed
    : articleTitle;

  return (
    <div ref={ref} className={cn(
      'group relative flex gap-3 rounded-xl border bg-card p-4 transition-all',
      isActive && 'border-violet-500/30 bg-violet-500/5',
      isCompleted && 'border-emerald-500/20',
      isFailed && 'border-rose-500/20 bg-rose-500/5',
    )}>
      {/* Status dot */}
      <div className="shrink-0 mt-1">
        <span className={cn(
          'flex size-2.5 rounded-full ring-4',
          cfg.dot, cfg.ring,
          cfg.pulse && 'animate-pulse',
        )} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Breadcrumb + date */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground truncate">
            {[slot.sectionName, slot.categoryName].filter(Boolean).join(' › ') || 'No section'}
          </span>
          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
            {dur !== null && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {dur}s
              </span>
            )}
            <span>{format(parseISO(slot.scheduledDate), 'MMM d')}</span>
          </div>
        </div>

        {/* Topic */}
        <p className="text-sm font-medium leading-snug text-foreground">
          {slot.topicName ?? slot.topicId}
        </p>

        {/* Active state: thinking animation */}
        {isActive && (
          <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
            <Sparkles className="size-3.5 shrink-0 animate-pulse" />
            <span className="italic">Generating article plan</span>
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1 rounded-full bg-violet-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        {/* Completed: article title */}
        {isCompleted && shownTitle && (
          <div className="mt-1 space-y-1">
            <p className={cn(
              'text-sm text-emerald-700 dark:text-emerald-400 font-medium leading-snug',
              animateTitle && !done && 'after:content-["▌"] after:animate-pulse after:ml-0.5 after:text-emerald-400',
            )}>
              {shownTitle}
            </p>
          </div>
        )}

        {/* Failed: error */}
        {isFailed && slot.errorMessage && (
          <p className="text-xs text-rose-500 mt-1">{slot.errorMessage}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {isCompleted && slot.articleId && (
            <Link
              href={`/dashboard/articles/${slot.articleId}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-3" />
              View Article
            </Link>
          )}

          {isCompleted && slot.planningData && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}

          {(isCompleted || isFailed) && (
            <button
              type="button"
              onClick={() => isCompleted ? onRedo(slot.id) : onRetry(slot.id)}
              disabled={(isRedoing || isRetrying) || !n8nAvailable}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {(isRedoing || isRetrying)
                ? <Loader2 className="size-3 animate-spin" />
                : <RotateCcw className="size-3" />}
              {isCompleted ? 'Redo' : 'Retry'}
            </button>
          )}
        </div>

        {/* Expanded planning data */}
        {expanded && slot.planningData && (
          <PlanningDataInline data={slot.planningData} />
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Inline Planning Data
// ---------------------------------------------------------------------------

function Field({ label, children }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-wide text-muted-foreground mb-1 text-[10px]">{label}</p>
      {children}
    </div>
  );
}

function PlanningDataInline({ data }) {
  return (
    <div className="mt-3 pt-3 border-t space-y-3 text-xs">

      {data.summary && (
        <Field label="Summary">
          <p className="text-foreground/80 leading-relaxed">{data.summary}</p>
        </Field>
      )}

      {data.articleAngle && (
        <Field label="Article Angle">
          <p className="text-foreground/80 leading-relaxed">{data.articleAngle}</p>
        </Field>
      )}

      {Array.isArray(data.outline) && data.outline.length > 0 && (
        <Field label="Outline">
          <ol className="list-decimal list-inside space-y-0.5 text-foreground/80">
            {data.outline.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        </Field>
      )}

      {Array.isArray(data.seoKeywords) && data.seoKeywords.length > 0 && (
        <Field label="SEO Keywords">
          <div className="flex flex-wrap gap-1">
            {data.seoKeywords.map((kw, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border">{kw}</span>
            ))}
          </div>
        </Field>
      )}

      {data.featuredImagePrompt && (
        <Field label="Featured Image Prompt">
          <p className="text-foreground/80 leading-relaxed italic">{data.featuredImagePrompt}</p>
        </Field>
      )}

      {Array.isArray(data.inlineImagePrompts) && data.inlineImagePrompts.length > 0 && (
        <Field label="Inline Image Prompts">
          <ol className="list-decimal list-inside space-y-0.5 text-foreground/80">
            {data.inlineImagePrompts.map((p, i) => <li key={i} className="italic">{p}</li>)}
          </ol>
        </Field>
      )}

      {data.videoIdea && (
        <Field label="Video Idea">
          <p className="text-foreground/80 leading-relaxed">{data.videoIdea}</p>
        </Field>
      )}

      {data.recommendedStatus && (
        <Field label="Recommended Status">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            {data.recommendedStatus}
          </span>
        </Field>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BatchDetailContent({ batchId }) {
  const qc = useQueryClient();
  const [n8nAvailable, setN8nAvailable] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Auto-scroll to the active slot whenever it changes
  const activeSlotRef = useRef(null);
  const prevActiveIdRef = useRef(null);

  // Track which slots should play the typewriter animation.
  // On initial load we populate prevStatusRef; subsequent polls detect transitions.
  const prevStatusRef = useRef(null);
  const [animatingTitles, setAnimatingTitles] = useState(new Set()); // slotIds

  const { data, isLoading, isError } = useQuery({
    queryKey: ['scheduler-batch', batchId],
    queryFn: () => fetchBatchDetail(batchId),
    refetchInterval: (q) => {
      const status = q.state.data?.batch?.status;
      return status === 'running' ? 2500 : status === 'paused' ? 8000 : false;
    },
  });

  // Detect newly completed slots and queue their title for typewriter
  useEffect(() => {
    if (!data?.slots) return;

    if (prevStatusRef.current === null) {
      // First load — seed the map without animating
      const map = {};
      data.slots.forEach((s) => { map[s.id] = s.status; });
      prevStatusRef.current = map;
      return;
    }

    const newlyCompleted = new Set();
    data.slots.forEach((s) => {
      if (
        s.status === 'completed' &&
        prevStatusRef.current[s.id] !== 'completed' &&
        s.planningData?.title
      ) {
        newlyCompleted.add(s.id);
      }
    });

    if (newlyCompleted.size > 0) {
      setAnimatingTitles((prev) => new Set([...prev, ...newlyCompleted]));
    }

    // Update prev map
    const map = {};
    data.slots.forEach((s) => { map[s.id] = s.status; });
    prevStatusRef.current = map;
  }, [data?.slots]);

  // Scroll to the active slot whenever it changes
  useEffect(() => {
    if (!data?.slots) return;
    const active = data.slots.find(
      (s) => s.status === 'sent_to_n8n' || s.status === 'generating',
    );
    const activeId = active?.id ?? null;
    if (activeId && activeId !== prevActiveIdRef.current) {
      prevActiveIdRef.current = activeId;
      // Small delay so the DOM has rendered the updated card before scrolling
      setTimeout(() => {
        activeSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    }
  }, [data?.slots]);

  // Mutations
  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ['scheduler-batch', batchId] }),
    [qc, batchId],
  );

  const stopMutation = useMutation({
    mutationFn: () => apiFetch(`/api/scheduler/batches/${batchId}/stop`, { method: 'POST' }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: invalidate,
  });

  const resumeMutation = useMutation({
    mutationFn: () => apiFetch(`/api/scheduler/batches/${batchId}/resume`, { method: 'POST' }).then(async (r) => {
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || 'Failed'); }
    }),
    onSuccess: invalidate,
  });

  const retryMutation = useMutation({
    mutationFn: (slotId) => apiFetch(`/api/scheduler/slots/${slotId}/retry`, { method: 'POST' }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: invalidate,
  });

  const redoMutation = useMutation({
    mutationFn: (slotId) => apiFetch(`/api/scheduler/slots/${slotId}/redo`, { method: 'POST' }).then((r) => { if (!r.ok) throw new Error(); }),
    onSuccess: invalidate,
  });

  const retryAllFailedMutation = useMutation({
    mutationFn: async () => {
      for (const slot of (data?.slots ?? []).filter((s) => s.status === 'failed')) {
        await apiFetch(`/api/scheduler/slots/${slot.id}/retry`, { method: 'POST' });
      }
    },
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <Container>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      </Container>
    );
  }

  if (isError || !data) {
    return (
      <Container>
        <Alert variant="destructive"><AlertDescription>Failed to load batch details.</AlertDescription></Alert>
      </Container>
    );
  }

  const { batch, slots = [], logs = [] } = data;
  const pct = batch.totalSlots
    ? Math.round(((batch.completedSlots + batch.failedSlots) / batch.totalSlots) * 100)
    : 0;
  const isRunning = batch.status === 'running';
  const isAutoPaused = batch.status === 'paused' && batch.pauseReason === 'n8n_unavailable';
  const totalDuration = formatDuration(batch.startedAt, batch.completedAt);

  const filteredSlots = statusFilter === 'all' ? slots : slots.filter((s) => s.status === statusFilter);

  // Group by date
  const grouped = filteredSlots.reduce((acc, slot) => {
    const key = slot.scheduledDate.split('T')[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  return (
    <Container>
      <div className="mb-4">
        <Link href="/dashboard/scheduler" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="size-4" />
          Back to Scheduler
        </Link>
      </div>

      <div className="space-y-5">
        {/* Header */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{batch.name}</h2>
                  <span className={cn('text-sm font-medium capitalize', BATCH_STATUS_CFG[batch.status])}>
                    {isRunning && <Loader2 className="size-3.5 inline mr-1 animate-spin" />}
                    {batch.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(batch.startDate), 'MMM d')} – {format(parseISO(batch.endDate), 'MMM d, yyyy')} · {batch.postsPerDay} posts/day
                </p>
                <div className="flex gap-3 text-xs text-muted-foreground flex-wrap pt-1">
                  {batch.startedAt && <span>Started {format(parseISO(batch.startedAt), 'MMM d, HH:mm')}</span>}
                  {batch.completedAt && <span>Completed {format(parseISO(batch.completedAt), 'HH:mm')}</span>}
                  {totalDuration && (
                    <span className="flex items-center gap-1"><Clock className="size-3" />{totalDuration} total</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <N8nStatusBadge onStatusChange={setN8nAvailable} />
                {isRunning && (
                  <Button size="sm" variant="outline" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}>
                    <Square className="size-3.5 mr-1.5" />Stop
                  </Button>
                )}
                {batch.status === 'paused' && (
                  <Button size="sm" onClick={() => resumeMutation.mutate()} disabled={!n8nAvailable || resumeMutation.isPending}>
                    {resumeMutation.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Play className="size-3.5 mr-1.5" />}
                    Resume
                  </Button>
                )}
                {batch.failedSlots > 0 && (
                  <Button size="sm" variant="outline" onClick={() => retryAllFailedMutation.mutate()} disabled={!n8nAvailable || retryAllFailedMutation.isPending}>
                    <RefreshCw className="size-3.5 mr-1.5" />Retry All Failed
                  </Button>
                )}
              </div>
            </div>

            {isAutoPaused && (
              <Alert className="mt-3 py-2 border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="size-3.5 text-amber-500" />
                <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                  Auto-paused — AI Agent was unreachable. No slots were lost. Resume when the AI Agent is back online.
                </AlertDescription>
              </Alert>
            )}

            {batch.totalSlots > 0 && (
              <div className="mt-4 space-y-1.5">
                <Progress value={pct} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{pct}% complete</span>
                  <span>{batch.completedSlots} / {batch.totalSlots} slots</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: batch.totalSlots, Icon: FileText },
            { label: 'Completed', value: batch.completedSlots, Icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'Failed', value: batch.failedSlots, Icon: XCircle, color: 'text-rose-500' },
            { label: 'Remaining', value: slots.filter((s) => s.status === 'planned').length, Icon: Clock, color: 'text-sky-500' },
          ].map(({ label, value, Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3 flex items-center gap-2">
                <Icon className={cn('size-4 shrink-0', color ?? 'text-muted-foreground')} />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Slots feed */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Slots</CardTitle>
              <div className="flex gap-1 flex-wrap">
                {[
                  { value: 'all',         label: 'All' },
                  { value: 'planned',     label: 'Planned' },
                  { value: 'sent_to_n8n', label: 'Queued' },
                  { value: 'generating',  label: 'Generating' },
                  { value: 'completed',   label: 'Completed' },
                  { value: 'failed',      label: 'Failed' },
                ].map(({ value, label }) => {
                  const count = value === 'all' ? slots.length : slots.filter((sl) => sl.status === value).length;
                  if (value !== 'all' && count === 0) return null;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                        statusFilter === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                      )}
                    >
                      {label} <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-0">
            {filteredSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No slots match this filter.</p>
            ) : (
              <ScrollArea className="h-[560px] pr-1">
                <div className="space-y-5 pr-1">
                  {Object.entries(grouped).map(([dateKey, daySlots]) => (
                    <div key={dateKey}>
                      {/* Date divider */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {format(parseISO(dateKey), 'EEEE, MMMM d')}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">{daySlots.length} slot{daySlots.length !== 1 ? 's' : ''}</span>
                      </div>

                      <div className="space-y-2">
                        {daySlots.map((slot) => {
                          const isActiveSlot =
                            slot.status === 'sent_to_n8n' || slot.status === 'generating';
                          return (
                            <SlotCard
                              key={slot.id}
                              ref={isActiveSlot ? activeSlotRef : null}
                              slot={slot}
                              animateTitle={animatingTitles.has(slot.id)}
                              onRedo={(id) => redoMutation.mutate(id)}
                              onRetry={(id) => retryMutation.mutate(id)}
                              isRedoing={redoMutation.isPending && redoMutation.variables === slot.id}
                              isRetrying={retryMutation.isPending && retryMutation.variables === slot.id}
                              n8nAvailable={n8nAvailable}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Activity log */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base">Activity Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              {logs.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="divide-y">
                  {logs.map((log) => (
                    <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                      <span className={cn(
                        'shrink-0 mt-0.5 inline-flex px-1.5 py-0.5 rounded text-xs font-mono font-medium',
                        log.action === 'create' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                        log.action === 'failed'  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' :
                        log.action === 'auto_pause' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                        log.action === 'redo'    ? 'bg-violet-500/10 text-violet-700 dark:text-violet-400' :
                        log.action === 'trigger' ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {log.action ?? 'log'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{log.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(log.createdAt), 'MMM d, HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
