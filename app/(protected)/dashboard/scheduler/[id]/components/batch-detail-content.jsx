'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, differenceInSeconds, formatDistanceStrict } from 'date-fns';
import {
  Play,
  Square,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ExternalLink,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { N8nStatusBadge } from '../../components/n8n-status-badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLOT_STATUS_CFG = {
  planned: { label: 'Planned', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
  sent_to_n8n: { label: 'Sent to n8n', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  generating: { label: 'Generating', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  completed: { label: 'Completed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  failed: { label: 'Failed', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
};

function SlotStatusBadge({ status }) {
  const cfg = SLOT_STATUS_CFG[status] ?? { label: status, color: '', bg: '' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  );
}

const BATCH_STATUS_CFG = {
  draft: 'text-muted-foreground',
  scheduled: 'text-sky-600 dark:text-sky-400',
  running: 'text-primary',
  paused: 'text-amber-600 dark:text-amber-400',
  completed: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-rose-600 dark:text-rose-400',
};

function formatDuration(startedAt, completedAt) {
  if (!startedAt) return null;
  const end = completedAt ? new Date(completedAt) : new Date();
  const secs = differenceInSeconds(end, new Date(startedAt));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function formatSlotDuration(triggeredAt, completedAt) {
  if (!triggeredAt || !completedAt) return '—';
  const secs = differenceInSeconds(new Date(completedAt), new Date(triggeredAt));
  return `${secs}s`;
}

function avgSlotDuration(slots) {
  const completed = slots.filter((s) => s.triggeredAt && s.completedAt);
  if (completed.length === 0) return null;
  const total = completed.reduce(
    (sum, s) => sum + differenceInSeconds(new Date(s.completedAt), new Date(s.triggeredAt)),
    0,
  );
  return Math.round(total / completed.length);
}

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

async function fetchBatchDetail(id) {
  const res = await apiFetch(`/api/scheduler/batches/${id}`);
  if (!res.ok) throw new Error('Failed to load batch');
  const j = await res.json();
  return j.data;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BatchDetailContent({ batchId }) {
  const qc = useQueryClient();
  const [n8nAvailable, setN8nAvailable] = useState(false);
  const [viewResultSlot, setViewResultSlot] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['scheduler-batch', batchId],
    queryFn: () => fetchBatchDetail(batchId),
    refetchInterval: (d) => {
      const status = d?.batch?.status;
      return status === 'running' ? 3000 : false;
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/scheduler/batches/${batchId}/stop`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler-batch', batchId] }),
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/scheduler/batches/${batchId}/resume`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to resume');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler-batch', batchId] }),
  });

  const retryMutation = useMutation({
    mutationFn: async (slotId) => {
      const res = await apiFetch(`/api/scheduler/slots/${slotId}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to retry');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler-batch', batchId] }),
  });

  const retryAllFailedMutation = useMutation({
    mutationFn: async () => {
      const failed = (data?.slots ?? []).filter((s) => s.status === 'failed');
      for (const slot of failed) {
        await apiFetch(`/api/scheduler/slots/${slot.id}/retry`, { method: 'POST' });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler-batch', batchId] }),
  });

  if (isLoading) {
    return (
      <Container>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </Container>
    );
  }

  if (isError || !data) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertDescription>Failed to load batch details.</AlertDescription>
        </Alert>
      </Container>
    );
  }

  const { batch, slots = [], logs = [] } = data;
  const pct = batch.totalSlots
    ? Math.round(((batch.completedSlots + batch.failedSlots) / batch.totalSlots) * 100)
    : 0;
  const stillPlanned = slots.filter((s) => s.status === 'planned').length;
  const avgDuration = avgSlotDuration(slots);
  const successRate = batch.completedSlots + batch.failedSlots > 0
    ? Math.round((batch.completedSlots / (batch.completedSlots + batch.failedSlots)) * 100)
    : null;
  const isAutoPaused = batch.status === 'paused' && batch.pauseReason === 'n8n_unavailable';
  const totalDuration = formatDuration(batch.startedAt, batch.completedAt);

  const filteredSlots = statusFilter === 'all'
    ? slots
    : slots.filter((s) => s.status === statusFilter);

  return (
    <Container>
      {/* Back nav */}
      <div className="mb-4">
        <Link href="/dashboard/scheduler" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="size-4" />
          Back to Scheduler
        </Link>
      </div>

      <div className="space-y-5">
        {/* Header Card */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{batch.name}</h2>
                  <span className={cn('text-sm font-medium capitalize', BATCH_STATUS_CFG[batch.status] ?? '')}>
                    {batch.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(parseISO(batch.startDate), 'MMM d')} –{' '}
                  {format(parseISO(batch.endDate), 'MMM d, yyyy')} · {batch.postsPerDay} posts/day
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(batch.sectionIds ?? []).length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {batch.sectionIds.length} section{batch.sectionIds.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {(batch.categoryIds ?? []).length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {batch.categoryIds.length} categor{batch.categoryIds.length !== 1 ? 'ies' : 'y'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  {batch.createdAt && (
                    <span>Created {format(parseISO(batch.createdAt), 'MMM d, yyyy HH:mm')}</span>
                  )}
                  {batch.startedAt && (
                    <span>Started {format(parseISO(batch.startedAt), 'HH:mm')}</span>
                  )}
                  {batch.completedAt && (
                    <span>Completed {format(parseISO(batch.completedAt), 'HH:mm')}</span>
                  )}
                  {totalDuration && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {totalDuration} total
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <N8nStatusBadge onStatusChange={setN8nAvailable} />
                {batch.status === 'running' && (
                  <Button size="sm" variant="outline" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}>
                    <Square className="size-3.5 mr-1.5" />
                    Stop
                  </Button>
                )}
                {batch.status === 'paused' && (
                  <Button size="sm" onClick={() => resumeMutation.mutate()} disabled={!n8nAvailable || resumeMutation.isPending}>
                    <Play className="size-3.5 mr-1.5" />
                    Resume
                  </Button>
                )}
                {batch.failedSlots > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryAllFailedMutation.mutate()}
                    disabled={!n8nAvailable || retryAllFailedMutation.isPending}
                  >
                    <RotateCcw className="size-3.5 mr-1.5" />
                    Retry All Failed
                  </Button>
                )}
              </div>
            </div>

            {isAutoPaused && (
              <Alert className="mt-3 py-2 border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="size-3.5 text-amber-500" />
                <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                  Auto-paused — n8n was unreachable. No slots were lost. Resume when n8n is back online.
                </AlertDescription>
              </Alert>
            )}

            {batch.totalSlots > 0 && (
              <div className="mt-4 space-y-1.5">
                <Progress value={pct} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pct}% complete</span>
                  <span>{batch.completedSlots} / {batch.totalSlots}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Slots', value: batch.totalSlots, icon: FileText },
            { label: 'Completed', value: batch.completedSlots, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'Failed', value: batch.failedSlots, icon: XCircle, color: 'text-rose-500' },
            { label: 'Remaining', value: stillPlanned, icon: Clock, color: 'text-sky-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Icon className={cn('size-4 shrink-0', color ?? 'text-muted-foreground')} />
                  <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {(avgDuration !== null || successRate !== null) && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            {avgDuration !== null && (
              <span>Avg per slot: <strong className="text-foreground">{avgDuration}s</strong></span>
            )}
            {successRate !== null && (
              <span>Success rate: <strong className="text-foreground">{successRate}%</strong></span>
            )}
          </div>
        )}

        {/* Slots Table */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Scheduled Slots</CardTitle>
              <div className="flex gap-1 flex-wrap">
                {['all', 'planned', 'sent_to_n8n', 'generating', 'completed', 'failed'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                      statusFilter === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
                    {s !== 'all' && (
                      <span className="ml-1 opacity-70">
                        ({slots.filter((sl) => sl.status === s).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground text-xs">
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Section</th>
                    <th className="px-4 py-2 text-left font-medium">Category</th>
                    <th className="px-4 py-2 text-left font-medium">Topic</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Duration</th>
                    <th className="px-4 py-2 text-left font-medium">Article</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlots.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        No slots match this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSlots.map((slot) => (
                      <tr key={slot.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                          {format(parseISO(slot.scheduledDate), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground truncate max-w-[90px]">
                          {slot.sectionName ?? '—'}
                        </td>
                        <td className="px-4 py-2 truncate max-w-[110px]">
                          {slot.categoryName ?? '—'}
                        </td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/dashboard/topics/${slot.topicId}`}
                            className="hover:underline font-medium truncate block max-w-[140px]"
                          >
                            {slot.topicName ?? slot.topicId}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <SlotStatusBadge status={slot.status} />
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                          {formatSlotDuration(slot.triggeredAt, slot.completedAt)}
                        </td>
                        <td className="px-4 py-2">
                          {slot.articleId ? (
                            <Link
                              href={`/dashboard/articles/${slot.articleId}`}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="size-3" />
                              View
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            {slot.planningData && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setViewResultSlot(slot)}
                              >
                                <Info className="size-3 mr-1" />
                                Result
                              </Button>
                            )}
                            {slot.status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-rose-600 hover:text-rose-700"
                                onClick={() => retryMutation.mutate(slot.id)}
                                disabled={retryMutation.isPending}
                              >
                                <RotateCcw className="size-3 mr-1" />
                                Retry
                              </Button>
                            )}
                            {slot.errorMessage && !slot.planningData && (
                              <span className="text-xs text-rose-500 truncate max-w-[100px]" title={slot.errorMessage}>
                                {slot.errorMessage}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base">Activity Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              {logs.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="divide-y">
                  {logs.map((log) => (
                    <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <span className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium',
                          log.action === 'create' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                          log.action === 'failed' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' :
                          log.action === 'auto_pause' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                          log.action === 'trigger' ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400' :
                          'bg-muted text-muted-foreground',
                        )}>
                          {log.action ?? 'log'}
                        </span>
                      </div>
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

      {/* View Result Dialog */}
      <Dialog open={!!viewResultSlot} onOpenChange={() => setViewResultSlot(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Planning Result — {viewResultSlot?.topicName ?? 'Slot'}</DialogTitle>
          </DialogHeader>
          {viewResultSlot?.planningData && (
            <PlanningDataView data={viewResultSlot.planningData} />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Planning Data View
// ---------------------------------------------------------------------------

function PlanningDataView({ data }) {
  const fields = [
    { key: 'title', label: 'Title' },
    { key: 'summary', label: 'Summary' },
    { key: 'articleAngle', label: 'Article Angle' },
    { key: 'outline', label: 'Outline' },
    { key: 'featuredImagePrompt', label: 'Featured Image Prompt' },
    { key: 'videoIdea', label: 'Video Idea' },
  ];
  const arrayFields = [
    { key: 'inlineImagePrompts', label: 'Inline Image Prompts' },
    { key: 'seoKeywords', label: 'SEO Keywords' },
  ];

  return (
    <div className="space-y-4 text-sm">
      {fields.map(({ key, label }) =>
        data[key] ? (
          <div key={key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
            <p className="text-foreground whitespace-pre-wrap">{data[key]}</p>
          </div>
        ) : null,
      )}
      {arrayFields.map(({ key, label }) =>
        Array.isArray(data[key]) && data[key].length > 0 ? (
          <div key={key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
            <ul className="list-disc list-inside space-y-0.5">
              {data[key].map((item, i) => (
                <li key={i} className="text-foreground">{item}</li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
      {data.recommendedStatus && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Recommended Status</p>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {data.recommendedStatus}
          </span>
        </div>
      )}
    </div>
  );
}
