'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Gauge,
  LayoutGrid,
  Layers,
  Plug,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Container } from '@/components/common/container';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

// ─── Pipeline stage bar colors (ordered planning → post-publish) ──────────
const PIPELINE_BAR_CLASSES = {
  planning: 'bg-slate-400',
  research: 'bg-indigo-500',
  writing: 'bg-blue-500',
  assets: 'bg-violet-500',
  approval: 'bg-amber-500',
  scheduling: 'bg-purple-500',
  publishing: 'bg-emerald-500',
  post_publish: 'bg-teal-500',
};

// ─── Upcoming-schedule source → display color/label ────────────────────────
const SOURCE_COLOR_CLASSES = {
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const SOURCE_DOT_CLASSES = {
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
};

const SOURCE_LABELS = {
  articles: 'Article',
  social: 'Social',
  video: 'Video',
  scheduler: 'Scheduler',
};

// ─── ContentLog action → activity dot color ─────────────────────────────────
const ACTION_DOT_CLASSES = {
  create: 'bg-emerald-500',
  update: 'bg-sky-500',
  status_change: 'bg-violet-500',
  archive: 'bg-amber-500',
  delete: 'bg-rose-500',
};

// ─── Readiness color ────────────────────────────────────────────────────────
const READINESS_CLASSES = {
  on_track: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
  at_risk: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
  overdue: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400',
};

const READINESS_LABELS = {
  on_track: 'On track',
  at_risk: 'At risk',
  overdue: 'Overdue',
};

// ─── KPI Stat card ─────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, iconClass, trend }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className={cn('rounded-lg p-2.5', iconClass)}>
            <Icon className="size-5" />
          </div>
          {trend ? (
            <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
              <ArrowUpRight className="size-3" />
              {trend}
            </span>
          ) : null}
        </div>
        <div className="mt-3">
          <p className="text-3xl font-bold text-foreground">{value}</p>
          <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5">
        <Skeleton className="size-10 rounded-lg" />
        <div className="mt-3 space-y-1.5">
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Pipeline stage row (horizontal bar) ───────────────────────────────────
function PipelineStageRow({ stage, max }) {
  const pct = max > 0 && stage.value > 0 ? Math.max((stage.value / max) * 100, 3) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-xs text-muted-foreground sm:w-28">
        {stage.label}
      </span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-300', PIPELINE_BAR_CLASSES[stage.id] ?? 'bg-muted-foreground')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
        {stage.value}
      </span>
    </div>
  );
}

// ─── Custom area tooltip ────────────────────────────────────────────────────
function AreaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === 'articles' ? 'Articles created' : 'Activity events'}: {p.value}
        </p>
      ))}
    </div>
  );
}

function safeFormat(value, fmt) {
  if (!value) return '—';
  try {
    const d = typeof value === 'string' ? parseISO(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, fmt);
  } catch {
    return '—';
  }
}

function daysWaiting(value) {
  if (!value) return null;
  try {
    const d = typeof value === 'string' ? parseISO(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return formatDistanceToNowStrict(d);
  } catch {
    return null;
  }
}

async function fetchDashboardOverview() {
  const r = await apiFetch('/api/dashboard/overview');
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load dashboard data');
  }
  const j = await r.json();
  return j.data;
}

export function DashboardHomeContent() {
  const { data, isPending, isError, error, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: fetchDashboardOverview,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const stats = data?.stats;
  const sections = data?.sections ?? [];
  const pipeline = data?.pipeline ?? [];
  const trend = data?.trend ?? [];
  const articlesAtRisk = data?.articlesAtRisk ?? [];
  const approvals = data?.approvals ?? [];
  const seoSnapshot = data?.seoSnapshot ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const upcoming = data?.upcoming ?? [];
  const integrations = data?.integrations ?? [];

  const pipelineMax = useMemo(
    () => pipeline.reduce((max, s) => Math.max(max, s.value), 0),
    [pipeline],
  );

  const lastUpdatedLabel = useMemo(() => {
    if (!dataUpdatedAt) return null;
    try {
      return formatDistanceToNowStrict(new Date(dataUpdatedAt), { addSuffix: true });
    } catch {
      return null;
    }
  }, [dataUpdatedAt]);

  const showSkeleton = isPending && !data;

  return (
    <Container>
      <div className="flex flex-col gap-5 lg:gap-7.5">

        {/* ── Header ── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Operations overview</h2>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Live data{lastUpdatedLabel ? ` · updated ${lastUpdatedLabel}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/approvals">View approvals</Link>
            </Button>
          </div>
        </div>

        {isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Could not load dashboard data</AlertTitle>
            <AlertDescription>{error?.message || 'Unknown error'}</AlertDescription>
          </Alert>
        ) : null}

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
          {showSkeleton ? (
            Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                icon={LayoutGrid}
                label="Sections"
                value={stats.sectionsActive}
                sub={`${stats.sectionsTotal} total verticals`}
                iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              />
              <StatCard
                icon={FolderOpen}
                label="Categories"
                value={stats.categoriesActive}
                sub={`${stats.categoriesTotal} total`}
                iconClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                trend={stats.categoriesCreatedThisWeek > 0 ? `+${stats.categoriesCreatedThisWeek} this week` : null}
              />
              <StatCard
                icon={BookOpen}
                label="Topics"
                value={stats.topicsActive}
                sub={`${stats.topicsTotal} total`}
                iconClass="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
                trend={stats.topicsCreatedThisWeek > 0 ? `+${stats.topicsCreatedThisWeek} this week` : null}
              />
              <StatCard
                icon={FileText}
                label="Articles"
                value={stats.articlesTotal}
                sub={`${stats.publishedCount} published`}
                iconClass="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                trend={stats.articlesCreatedThisWeek > 0 ? `+${stats.articlesCreatedThisWeek} this week` : null}
              />
              <StatCard
                icon={AlertTriangle}
                label="At risk / overdue"
                value={stats.atRiskCount}
                sub={`${stats.overdueCount} overdue`}
                iconClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
              />
              <StatCard
                icon={Gauge}
                label="Avg. SEO score"
                value={stats.avgSeoScore ?? '—'}
                sub={`Across ${stats.seoScoredCount} scored articles`}
                iconClass="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              />
            </>
          )}
        </div>

        {/* ── Pipeline stages + Activity trend ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

          {/* Pipeline stage breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4 text-primary" />
                Pipeline distribution
              </CardTitle>
              <CardDescription>
                {showSkeleton ? 'Loading…' : `${stats.articlesTotal} articles across the content pipeline`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showSkeleton ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-2.5 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {pipeline.map((stage) => (
                    <PipelineStageRow key={stage.id} stage={stage} max={pipelineMax} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Area chart */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" />
                Content activity
              </CardTitle>
              <CardDescription>Articles created and system events, last 8 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              {showSkeleton ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorArticles" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip content={<AreaTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="tasks"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#colorTasks)"
                          dot={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="articles"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fill="url(#colorArticles)"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-500" />Articles created</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Activity events</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Sections distribution ── */}
        {sections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutGrid className="size-4 text-primary" />
                KG Sections
              </CardTitle>
              <CardDescription>
                {stats.sectionsActive} active verticals — categories per section
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                {sections.map((s) => (
                  <Link
                    key={s.id}
                    href={`/dashboard/sections/${s.id}`}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-center transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                      {s.characterName ? s.characterName[0] : s.name[0]}
                    </div>
                    <p className="line-clamp-1 text-xs font-medium leading-tight text-foreground">
                      {s.name}
                    </p>
                    {s.characterName && (
                      <p className="text-[10px] leading-tight text-muted-foreground">
                        {s.characterName}
                      </p>
                    )}
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      s.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {s.categoryCount} {s.categoryCount === 1 ? 'cat' : 'cats'}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Articles at risk + Pending approvals ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* Articles at risk */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-rose-500" />
                Articles at risk
              </CardTitle>
              <CardDescription>Readiness window and pipeline stage per article</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {showSkeleton ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              ) : articlesAtRisk.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No articles are currently at risk. Nice work.
                </p>
              ) : (
                articlesAtRisk.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <Link href={`/dashboard/articles/${a.id}`} className="text-sm font-medium text-foreground truncate hover:underline">
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Stage: <span className="capitalize">{a.stage.replace(/_/g, ' ')}</span>
                        {a.readinessDeadline ? <> · Due {safeFormat(a.readinessDeadline, 'MMM d')}</> : null}
                        {a.topicName ? <> · {a.topicName}</> : null}
                      </p>
                    </div>
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      READINESS_CLASSES[a.readiness] ?? 'bg-muted text-muted-foreground'
                    )}>
                      {READINESS_LABELS[a.readiness] ?? a.readiness}
                    </span>
                  </div>
                ))
              )}
              <Button variant="link" size="sm" asChild className="px-0 h-auto">
                <Link href="/dashboard/articles">All articles <ArrowRight className="size-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>

          {/* Pending approvals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-4 text-primary" />
                Approvals queue
              </CardTitle>
              <CardDescription>
                {showSkeleton ? 'Loading…' : `${stats.pendingApprovalsCount} pending — requires editor action`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {showSkeleton ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              ) : approvals.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Nothing waiting on approval right now.
                </p>
              ) : (
                approvals.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <Link href={`/dashboard/articles/${a.id}`} className="text-sm font-medium text-foreground truncate hover:underline block">
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.categoryName ?? 'Uncategorized'} · {a.topicName ?? '—'}
                      </p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Clock className="size-3" />
                      {daysWaiting(a.waitingSince) ?? 'pending'}
                    </span>
                  </div>
                ))
              )}
              <Button variant="secondary" className="w-full" asChild>
                <Link href="/dashboard/approvals">Open full queue</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Calendar + Activity log ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* Upcoming schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="size-4" />
                Upcoming schedule
              </CardTitle>
              <CardDescription>
                Publish dates, social posts, video and scheduler slots — live feed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {showSkeleton ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)
              ) : upcoming.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Nothing scheduled in the near future.
                </p>
              ) : (
                upcoming.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <span className={cn('size-2 rounded-full shrink-0', SOURCE_DOT_CLASSES[ev.color] ?? 'bg-muted-foreground')} />
                    <div className="min-w-0 grow">
                      <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {safeFormat(ev.start, 'EEE, MMM d · h:mm a')}
                      </p>
                    </div>
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      SOURCE_COLOR_CLASSES[ev.color] ?? 'bg-muted text-muted-foreground'
                    )}>
                      {SOURCE_LABELS[ev.source] ?? ev.source}
                    </span>
                  </div>
                ))
              )}
              <Button variant="link" size="sm" asChild className="px-0 h-auto">
                <Link href="/dashboard/calendar">Full calendar <ArrowRight className="size-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>

          {/* Activity log */}
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest system events across content, articles, and projects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {showSkeleton ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              ) : recentActivity.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No activity logged yet.
                </p>
              ) : (
                recentActivity.map((e) => (
                  <div key={e.id} className="flex items-start gap-3">
                    <span className={cn('mt-1.5 size-2 rounded-full shrink-0', ACTION_DOT_CLASSES[e.action] ?? 'bg-muted-foreground')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        <span className="text-muted-foreground font-normal">[{e.type}]</span>{' '}
                        {e.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.userLabel ?? 'System'} · {safeFormat(e.createdAt, 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/logs">All logs</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── SEO snapshot + Integrations ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

          {/* SEO with score bars */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="size-4" />
                SEO snapshot
              </CardTitle>
              <CardDescription>
                {showSkeleton
                  ? 'Loading…'
                  : `Avg. score: ${stats.avgSeoScore ?? '—'} / 100 — recently scored articles`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showSkeleton ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : seoSnapshot.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No SEO-scored articles yet.
                </p>
              ) : (
                seoSnapshot.map((s) => (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate text-foreground font-medium max-w-[70%]">{s.title}</span>
                      <span className={cn(
                        'text-xs font-semibold tabular-nums',
                        s.score >= 70 ? 'text-emerald-600' : s.score >= 50 ? 'text-amber-600' : 'text-rose-600'
                      )}>{s.score} / 100</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          s.score >= 70 ? 'bg-emerald-500' : s.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                        )}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    {s.keyword ? (
                      <p className="text-xs text-muted-foreground">
                        Keyword: <span className="text-foreground">{s.keyword}</span>
                      </p>
                    ) : null}
                  </div>
                ))
              )}
              <Button variant="link" asChild className="px-0 h-auto">
                <Link href="/dashboard/seo">SEO workspace <ArrowRight className="size-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>

          {/* Integrations with live status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plug className="size-4" />
                Integrations
              </CardTitle>
              <CardDescription>Live connection status for external systems</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {showSkeleton ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)
                ) : (
                  integrations.map((i) => (
                    <Link
                      key={i.id}
                      href={i.href ?? '/dashboard/settings/integrations'}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <BadgeDot className={i.connected ? 'text-emerald-500' : 'text-muted-foreground/50'} />
                      <div className="grow min-w-0">
                        <p className="text-sm font-medium text-foreground">{i.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{i.detail}</p>
                      </div>
                      <Badge
                        variant={i.connected ? 'success' : 'secondary'}
                        appearance="light"
                        size="sm"
                        className="shrink-0"
                      >
                        {i.connected ? 'Connected' : 'Not connected'}
                      </Badge>
                    </Link>
                  ))
                )}
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                <Link href="/dashboard/settings/integrations">
                  <Plug className="size-3 mr-1.5" /> Manage integrations
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </Container>
  );
}
