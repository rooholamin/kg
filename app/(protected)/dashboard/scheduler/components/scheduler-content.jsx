'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Play,
  Square,
  RotateCcw,
  Eye,
  ChevronRight,
  AlertTriangle,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { N8nStatusBadge } from './n8n-status-badge';
import { PreviewCalendarModal } from './preview-calendar-modal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH_STATUS_LABELS = {
  draft: { label: 'Draft', variant: 'secondary' },
  scheduled: { label: 'Scheduled', variant: 'outline' },
  running: { label: 'Running', variant: 'default' },
  paused: { label: 'Paused', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
};

function BatchStatusBadge({ status }) {
  const cfg = BATCH_STATUS_LABELS[status] ?? { label: status, variant: 'secondary' };
  const colorClass = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-border text-foreground',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
    destructive: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30',
  }[cfg.variant] ?? '';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {cfg.label}
    </span>
  );
}

function progressPercent(batch) {
  if (!batch.totalSlots) return 0;
  return Math.round(((batch.completedSlots + batch.failedSlots) / batch.totalSlots) * 100);
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchBatches() {
  const res = await apiFetch('/api/scheduler/batches');
  if (!res.ok) throw new Error('Failed to load batches');
  return res.json();
}

async function fetchSections() {
  const res = await apiFetch('/api/sections');
  if (!res.ok) throw new Error('Failed to load sections');
  return res.json();
}

async function fetchCategories() {
  const res = await apiFetch('/api/categories');
  if (!res.ok) throw new Error('Failed to load categories');
  return res.json();
}

async function fetchTopics() {
  const res = await apiFetch('/api/topics');
  if (!res.ok) throw new Error('Failed to load topics');
  return res.json();
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SchedulerContent() {
  const qc = useQueryClient();
  const [n8nAvailable, setN8nAvailable] = useState(false);

  // Form state
  const [batchName, setBatchName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [postsPerDay, setPostsPerDay] = useState(2);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedExcludeTopicIds, setSelectedExcludeTopicIds] = useState([]);

  // Preview state
  const [previewSlots, setPreviewSlots] = useState(null);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ['scheduler-batches'],
    queryFn: fetchBatches,
  });
  const batches = batchesData?.data ?? [];

  const { data: sectionsData } = useQuery({ queryKey: ['sections'], queryFn: fetchSections });
  const sections = sectionsData?.data ?? [];

  const { data: categoriesData } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const categories = categoriesData?.data ?? [];

  const { data: topicsData } = useQuery({ queryKey: ['topics'], queryFn: fetchTopics });
  const topics = topicsData?.data ?? [];

  // Filtered categories based on selected sections
  const filteredCategories = selectedSectionIds.length > 0
    ? categories.filter((c) => selectedSectionIds.includes(c.sectionId))
    : categories;

  const filteredTopics = selectedCategoryIds.length > 0
    ? topics.filter((t) => selectedCategoryIds.includes(t.categoryId))
    : topics;

  // Create batch mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/scheduler/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: batchName,
          startDate,
          endDate,
          postsPerDay,
          sectionIds: selectedSectionIds,
          categoryIds: selectedCategoryIds,
          excludeTopicIds: selectedExcludeTopicIds,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to create batch');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduler-batches'] });
      setPreviewOpen(false);
      setPreviewSlots(null);
      setBatchName('');
      setStartDate('');
      setEndDate('');
      setPostsPerDay(2);
      setSelectedSectionIds([]);
      setSelectedCategoryIds([]);
      setSelectedExcludeTopicIds([]);
    },
  });

  // Run batch
  const runMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiFetch(`/api/scheduler/batches/${id}/run`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to start batch');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler-batches'] }),
  });

  // Stop batch
  const stopMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiFetch(`/api/scheduler/batches/${id}/stop`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop batch');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler-batches'] }),
  });

  // Resume batch
  const resumeMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiFetch(`/api/scheduler/batches/${id}/resume`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to resume batch');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduler-batches'] }),
  });

  // Preview schedule
  const handlePreview = useCallback(async () => {
    if (!startDate || !endDate || selectedCategoryIds.length === 0) {
      setPreviewError('Date range and at least one category are required.');
      return;
    }
    setPreviewError(null);
    setIsPreviewing(true);
    try {
      const res = await apiFetch('/api/scheduler/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          postsPerDay,
          sectionIds: selectedSectionIds,
          categoryIds: selectedCategoryIds,
          excludeTopicIds: selectedExcludeTopicIds,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Preview failed');
      }
      const j = await res.json();
      setPreviewSlots(j.data ?? []);
      setPreviewTotal(j.total ?? 0);
      setPreviewOpen(true);
    } catch (err) {
      setPreviewError(err.message);
    } finally {
      setIsPreviewing(false);
    }
  }, [startDate, endDate, postsPerDay, selectedSectionIds, selectedCategoryIds, selectedExcludeTopicIds]);

  const toggleId = (list, setList, id) => {
    setList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <Container>
      {/* n8n Status Banner */}
      <div className="flex items-center justify-between mb-4">
        <N8nStatusBadge onStatusChange={setN8nAvailable} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-6">
        {/* LEFT — Create Batch Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-4" />
                Create Schedule Batch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="batch-name">Batch Name</Label>
                <Input
                  id="batch-name"
                  placeholder="e.g. June 2026 Week 1"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="posts-per-day">Posts Per Day</Label>
                <Input
                  id="posts-per-day"
                  type="number"
                  min={1}
                  max={20}
                  value={postsPerDay}
                  onChange={(e) => setPostsPerDay(Number(e.target.value))}
                />
              </div>

              {/* Sections */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Sections <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                      disabled={sections.filter((s) => s.status === 'active').length === 0}
                      onClick={() => {
                        const allIds = sections.filter((s) => s.status === 'active').map((s) => s.id);
                        const allSelected = allIds.every((id) => selectedSectionIds.includes(id));
                        setSelectedSectionIds(allSelected ? [] : allIds);
                      }}
                    >
                      {sections.filter((s) => s.status === 'active').every((s) => selectedSectionIds.includes(s.id)) && sections.filter((s) => s.status === 'active').length > 0
                        ? 'Deselect all'
                        : 'Select all'}
                    </button>
                  </div>
                </div>
                <ScrollArea className="h-28 rounded-md border p-2">
                  <div className="space-y-1">
                    {sections.filter((s) => s.status === 'active').map((s) => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm hover:text-foreground text-muted-foreground">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedSectionIds.includes(s.id)}
                          onChange={() => toggleId(selectedSectionIds, setSelectedSectionIds, s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                    {sections.length === 0 && (
                      <p className="text-xs text-muted-foreground">No sections found</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Categories */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Categories <span className="text-rose-500 text-xs">*</span></Label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                      disabled={filteredCategories.filter((c) => c.status === 'active').length === 0}
                      onClick={() => {
                        const allIds = filteredCategories.filter((c) => c.status === 'active').map((c) => c.id);
                        const allSelected = allIds.every((id) => selectedCategoryIds.includes(id));
                        setSelectedCategoryIds(allSelected ? [] : allIds);
                      }}
                    >
                      {filteredCategories.filter((c) => c.status === 'active').every((c) => selectedCategoryIds.includes(c.id)) && filteredCategories.filter((c) => c.status === 'active').length > 0
                        ? 'Deselect all'
                        : 'Select all'}
                    </button>
                  </div>
                </div>
                <ScrollArea className="h-36 rounded-md border p-2">
                  <div className="space-y-1">
                    {filteredCategories.filter((c) => c.status === 'active').map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm hover:text-foreground text-muted-foreground">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedCategoryIds.includes(c.id)}
                          onChange={() => toggleId(selectedCategoryIds, setSelectedCategoryIds, c.id)}
                        />
                        {c.name}
                        {c.section?.name && (
                          <span className="text-xs text-muted-foreground/60">· {c.section.name}</span>
                        )}
                      </label>
                    ))}
                    {filteredCategories.length === 0 && (
                      <p className="text-xs text-muted-foreground">No categories match</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Exclude Topics */}
              <div className="space-y-1.5">
                <Label>Exclude Topics <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <ScrollArea className="h-28 rounded-md border p-2">
                  <div className="space-y-1">
                    {filteredTopics.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer text-sm hover:text-foreground text-muted-foreground">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedExcludeTopicIds.includes(t.id)}
                          onChange={() => toggleId(selectedExcludeTopicIds, setSelectedExcludeTopicIds, t.id)}
                        />
                        {t.name}
                      </label>
                    ))}
                    {filteredTopics.length === 0 && (
                      <p className="text-xs text-muted-foreground">Select categories first</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {previewError && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-sm">{previewError}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={isPreviewing || !startDate || !endDate || selectedCategoryIds.length === 0}
                  className="w-full"
                >
                  {isPreviewing ? (
                    <RefreshCw className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="size-4 mr-2" />
                  )}
                  {isPreviewing ? 'Generating preview…' : 'Preview Schedule'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Batch List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Schedule Batches</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => qc.invalidateQueries({ queryKey: ['scheduler-batches'] })}
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {batchesLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : batches.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No batches yet. Create your first schedule batch.
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="divide-y">
                  {batches.map((batch) => (
                    <BatchRow
                      key={batch.id}
                      batch={batch}
                      n8nAvailable={n8nAvailable}
                      onRun={() => runMutation.mutate(batch.id)}
                      onStop={() => stopMutation.mutate(batch.id)}
                      onResume={() => resumeMutation.mutate(batch.id)}
                      isRunning={runMutation.isPending || resumeMutation.isPending}
                      isStopping={stopMutation.isPending}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Preview calendar modal */}
      <PreviewCalendarModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        slots={previewSlots ?? []}
        total={previewTotal}
        startDate={startDate}
        endDate={endDate}
        batchName={batchName}
        onConfirm={() => createMutation.mutate()}
        isConfirming={createMutation.isPending}
        confirmError={createMutation.isError ? createMutation.error?.message : null}
      />
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Batch Row
// ---------------------------------------------------------------------------

function BatchRow({ batch, n8nAvailable, onRun, onStop, onResume, isRunning, isStopping }) {
  const pct = progressPercent(batch);
  const isAutoPaused = batch.status === 'paused' && batch.pauseReason === 'n8n_unavailable';

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{batch.name}</span>
            <BatchStatusBadge status={batch.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(parseISO(batch.startDate), 'MMM d')} –{' '}
            {format(parseISO(batch.endDate), 'MMM d, yyyy')} · {batch.postsPerDay}/day
          </p>
        </div>
        <Link href={`/dashboard/scheduler/${batch.id}`}>
          <Button variant="ghost" size="icon" className="size-7 shrink-0">
            <ChevronRight className="size-4" />
          </Button>
        </Link>
      </div>

      {isAutoPaused && (
        <Alert className="py-2 border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="size-3 text-amber-500 shrink-0" />
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
            Auto-paused — n8n was unreachable. No slots were lost.
          </AlertDescription>
        </Alert>
      )}

      {batch.totalSlots > 0 && (
        <div className="space-y-1">
          <Progress value={pct} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {batch.completedSlots} / {batch.totalSlots} completed
              {batch.failedSlots > 0 && (
                <span className="text-rose-500 ml-1">· {batch.failedSlots} failed</span>
              )}
            </span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {(batch.status === 'draft' || batch.status === 'scheduled') && (
          <Button
            size="sm"
            variant="default"
            onClick={onRun}
            disabled={!n8nAvailable || isRunning}
            className="h-7 text-xs"
          >
            <Play className="size-3 mr-1.5" />
            Run
          </Button>
        )}
        {batch.status === 'running' && (
          <Button
            size="sm"
            variant="outline"
            onClick={onStop}
            disabled={isStopping}
            className="h-7 text-xs"
          >
            <Square className="size-3 mr-1.5" />
            Stop
          </Button>
        )}
        {batch.status === 'paused' && (
          <Button
            size="sm"
            variant="default"
            onClick={onResume}
            disabled={!n8nAvailable || isRunning}
            className="h-7 text-xs"
          >
            <Play className="size-3 mr-1.5" />
            Resume
          </Button>
        )}
      </div>
    </div>
  );
}
