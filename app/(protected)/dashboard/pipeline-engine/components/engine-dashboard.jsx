'use client';

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, PenLine, Image, Inbox, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { N8nStatusBadge } from '../../scheduler/components/n8n-status-badge';
import { EditorInChief } from './editor-in-chief';
import { QueueList } from './queue-list';
import { CompletedList } from './completed-list';
import { EngineCard } from './engine-card';

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function fetchEngineStatus() {
  const res = await apiFetch('/api/pipeline-engine');
  if (!res.ok) throw new Error('Failed to fetch engine status');
  const json = await res.json();
  return json.data;
}

async function startEngine(type) {
  const res = await apiFetch(`/api/pipeline-engine/${type}/start`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Failed to start engine');
  }
  return res.json();
}

async function pauseEngine(type) {
  const res = await apiFetch(`/api/pipeline-engine/${type}/pause`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Failed to pause engine');
  }
  return res.json();
}

async function updateSettings(type, delayMinutes) {
  const res = await apiFetch(`/api/pipeline-engine/${type}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delayMinutes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Failed to update settings');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Stage breakdown
// ---------------------------------------------------------------------------

function StageBreakdown({ byStage, pendingImages }) {
  const stages = [
    { key: 'planning', label: 'Need Research', icon: BookOpen, colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
    { key: 'research', label: 'Researching', icon: Search, colorClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', warnIfPositive: true },
    { key: 'writing', label: 'Need Writing', icon: PenLine, colorClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    {
      key: 'assets',
      label: 'Need Images',
      icon: Image,
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      subLabel: pendingImages > 0 ? `${pendingImages} image${pendingImages !== 1 ? 's' : ''} pending` : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {stages.map(({ key, label, icon: Icon, colorClass, warnIfPositive, subLabel }) => {
        const count = byStage[key] ?? 0;
        const isWarning = warnIfPositive && count > 0;
        return (
          <div
            key={key}
            className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
              isWarning ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/50 bg-muted/30'
            }`}
          >
            <div className={`p-1.5 rounded-md flex-shrink-0 mt-0.5 ${colorClass}`}>
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold leading-none">{count}</p>
              <p className={`text-[10px] mt-0.5 truncate ${isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                {isWarning ? 'Stalled — will retry' : label}
              </p>
              {subLabel && (
                <p className="text-[10px] text-muted-foreground/60 truncate">{subLabel}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Derive overall character state from all 3 engines
// ---------------------------------------------------------------------------

function getOverallCharacterState(engines) {
  if (!engines) return { status: 'idle', currentStep: null };
  const running = Object.entries(engines).find(([, e]) => e?.status === 'running');
  if (running) {
    const [id, engine] = running;
    return {
      status: 'running',
      // Priority: images > writing > research
      currentStep: engines.images?.status === 'running' ? 'assets'
        : engines.writing?.status === 'running' ? 'writing'
        : 'research',
    };
  }
  if (Object.values(engines).some((e) => e?.status === 'paused')) {
    return { status: 'paused', currentStep: null };
  }
  return { status: 'idle', currentStep: null };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ENGINE_IDS = ['research', 'writing', 'images'];

export function EngineDashboard() {
  const queryClient = useQueryClient();
  const [n8nAvailable, setN8nAvailable] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pipeline-engine'],
    queryFn: fetchEngineStatus,
    refetchInterval: (query) => {
      const engines = query.state.data?.engines ?? {};
      const anyRunning = Object.values(engines).some((e) => e?.status === 'running');
      return anyRunning ? 3_000 : 10_000;
    },
  });

  const engines = data?.engines ?? {};
  const queue = data?.queue ?? [];
  const recentHistory = data?.recentHistory ?? [];
  const queueCount = data?.queueCount ?? 0;
  const byStage = data?.byStage ?? {};
  const pendingImages = data?.pendingImages ?? 0;
  const skippedCounts = data?.skippedCounts ?? {};

  // Queue counts per engine type
  const queueByEngine = {
    research: (byStage.planning ?? 0) + (byStage.research ?? 0),
    writing: byStage.writing ?? 0,
    images: byStage.assets ?? 0,
  };

  const startMutation = useMutation({
    mutationFn: startEngine,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['pipeline-engine'] });
    },
    onError: (err) => setActionError(err.message),
  });

  const pauseMutation = useMutation({
    mutationFn: pauseEngine,
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['pipeline-engine'] });
    },
    onError: (err) => setActionError(err.message),
  });

  const settingsMutation = useMutation({
    mutationFn: ({ type, delayMinutes }) => updateSettings(type, delayMinutes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-engine'] }),
    onError: (err) => setActionError(err.message),
  });

  const handleN8nStatus = useCallback((available) => setN8nAvailable(available), []);

  const characterState = getOverallCharacterState(engines);

  if (isLoading) {
    return (
      <Container>
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertDescription>Failed to load engine status. Please refresh.</AlertDescription>
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <div className="space-y-6">
        {/* ── Top row: character + queue breakdown ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Character */}
          <Card className="overflow-hidden">
            <CardContent className="pt-5 pb-5 flex flex-col items-center gap-4">
              <EditorInChief
                status={characterState.status}
                currentStep={characterState.currentStep}
              />
              <N8nStatusBadge onStatusChange={handleN8nStatus} className="text-xs" />
              {actionError && (
                <p className="text-xs text-rose-500 text-center px-2">{actionError}</p>
              )}
            </CardContent>
          </Card>

          {/* Queue by stage */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Queue by Stage
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <StageBreakdown byStage={byStage} pendingImages={pendingImages} />
            </CardContent>
          </Card>
        </div>

        {/* ── Engine cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ENGINE_IDS.map((id) => (
            <EngineCard
              key={id}
              engineId={id}
              engine={engines[id]}
              n8nAvailable={n8nAvailable}
              queueCount={queueByEngine[id] ?? 0}
              skippedCount={skippedCounts[id] ?? 0}
              onStart={(type) => startMutation.mutate(type)}
              onPause={(type) => pauseMutation.mutate(type)}
              onSettingsChange={(type, delayMinutes) =>
                settingsMutation.mutate({ type, delayMinutes })
              }
              isStartPending={startMutation.isPending && startMutation.variables === id}
              isPausePending={pauseMutation.isPending && pauseMutation.variables === id}
            />
          ))}
        </div>

        {/* ── Queue + History ──────────────────────────────────────────── */}
        <Card>
          <Tabs defaultValue="queue">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Articles
                </CardTitle>
                <TabsList className="h-7">
                  <TabsTrigger value="queue" className="text-xs h-6 px-3 gap-1.5">
                    Queue
                    {queueCount > 0 && (
                      <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                        {queueCount > 99 ? '99+' : queueCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs h-6 px-3 gap-1.5">
                    History
                    {recentHistory.length > 0 && (
                      <span className="inline-flex items-center justify-center size-4 rounded-full bg-muted text-muted-foreground text-[9px] font-bold">
                        {recentHistory.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <TabsContent value="queue" className="mt-0">
                {queueCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Inbox className="size-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No articles in the pipeline</p>
                  </div>
                ) : (
                  <QueueList
                    items={queue}
                    activeArticleId={
                      Object.values(engines).find((e) => e?.currentArticleId)?.currentArticleId
                    }
                  />
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <CompletedList items={recentHistory} />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </Container>
  );
}
