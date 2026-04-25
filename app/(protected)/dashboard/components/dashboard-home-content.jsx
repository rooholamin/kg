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
  FileText,
  FolderOpen,
  Layers,
  Plug,
  Search,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
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
import { Input } from '@/components/ui/input';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import {
  DASHBOARD_STATS,
  MOCK_ACTIVITY,
  MOCK_APPROVALS,
  MOCK_ARTICLES,
  MOCK_CALENDAR_EVENTS,
  MOCK_INTEGRATIONS,
  MOCK_SEO_ARTICLES,
  PIPELINE_COUNTS,
  PIPELINE_STAGES,
} from '@/app/(protected)/dashboard/_mock';
import { cn } from '@/lib/utils';
import {
  articleRowsToCalendarEvents,
  calendarMockExcludingArticlePlan,
} from '@/lib/calendar-article-events';
import { apiFetch } from '@/lib/api';

// ─── Mock trend data for the area chart ────────────────────────────────────
const ACTIVITY_TREND = [
  { week: 'W1', articles: 2, tasks: 5 },
  { week: 'W2', articles: 4, tasks: 8 },
  { week: 'W3', articles: 3, tasks: 6 },
  { week: 'W4', articles: 6, tasks: 11 },
  { week: 'W5', articles: 5, tasks: 9 },
  { week: 'W6', articles: 8, tasks: 14 },
];

// ─── Pipeline donut data ────────────────────────────────────────────────────
const PIPELINE_COLORS = {
  planning: '#64748b',
  research: '#6366f1',
  writing: '#3b82f6',
  assets: '#8b5cf6',
  review: '#f59e0b',
  approval: '#f97316',
  scheduling: '#a855f7',
  publishing: '#10b981',
  post_publish: '#06b6d4',
};

// ─── Calendar event color map (matches product spec) ───────────────────────
const EVENT_COLOR_CLASSES = {
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const EVENT_DOT_CLASSES = {
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  orange: 'bg-orange-500',
};

// ─── Activity log status ────────────────────────────────────────────────────
const LOG_STATUS_CLASSES = {
  success: 'bg-emerald-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
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
          {trend && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
              <ArrowUpRight className="size-3" />
              {trend}
            </span>
          )}
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

// ─── Custom donut tooltip ───────────────────────────────────────────────────
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].value} article{payload[0].value !== 1 ? 's' : ''}</p>
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
          {p.dataKey === 'articles' ? 'Articles' : 'Tasks'}: {p.value}
        </p>
      ))}
    </div>
  );
}

async function fetchAllArticles() {
  const r = await apiFetch('/api/articles');
  if (!r.ok) return [];
  const j = await r.json();
  return j.data ?? [];
}

export function DashboardHomeContent() {
  const { data: articleRows, isPending: articlesPending } = useQuery({
    queryKey: ['articles', 'home-schedule'],
    queryFn: fetchAllArticles,
  });
  const articleList = articleRows ?? [];

  const nonArticleMock = useMemo(
    () => calendarMockExcludingArticlePlan(MOCK_CALENDAR_EVENTS),
    [],
  );
  const articleEvents = useMemo(
    () => articleRowsToCalendarEvents(articleList),
    [articleList],
  );
  const scheduleEvents = useMemo(
    () => [...articleEvents, ...nonArticleMock],
    [articleEvents, nonArticleMock],
  );

  const upcoming = useMemo(
    () =>
      [...scheduleEvents]
        .sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
        )
        .slice(0, 5),
    [scheduleEvents],
  );

  const pipelineDonutData = PIPELINE_STAGES
    .map((s) => ({ name: s.label, value: PIPELINE_COUNTS[s.id] ?? 0, id: s.id }))
    .filter((d) => d.value > 0);

  const totalArticles = articlesPending
    ? MOCK_ARTICLES.length
    : articleList.length;

  return (
    <Container>
      <div className="flex flex-col gap-5 lg:gap-7.5">

        {/* ── Header ── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Operations overview</h2>
            <p className="text-sm text-muted-foreground">
              Content pipeline, planning, and system health at a glance.{' '}
              <span className="text-foreground/60 text-xs">Mock data — Milestone 1.</span>
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="size-4 text-muted-foreground absolute start-2.5 top-1/2 -translate-y-1/2" />
              <Input className="ps-8" placeholder="Search (UI shell)" disabled aria-label="Search placeholder" />
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/approvals">View approvals</Link>
            </Button>
          </div>
        </div>

        <MilestoneNote milestone={2}>
          Dashboard metrics connect to the database in Milestone 2+.
        </MilestoneNote>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            icon={FolderOpen}
            label="Categories"
            value={DASHBOARD_STATS.categories}
            sub="Active content areas"
            iconClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
            trend="+1 this month"
          />
          <StatCard
            icon={BookOpen}
            label="Topics"
            value={DASHBOARD_STATS.topics}
            sub="Across all categories"
            iconClass="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400"
            trend="+2 this month"
          />
          <StatCard
            icon={FileText}
            label="Articles"
            value={DASHBOARD_STATS.articles}
            sub="In active pipeline"
            iconClass="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
            trend="+3 this week"
          />
          <StatCard
            icon={AlertTriangle}
            label="At risk / overdue"
            value={DASHBOARD_STATS.atRisk}
            sub="Readiness window breached"
            iconClass="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          />
        </div>

        {/* ── Pipeline donut + Activity trend ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

          {/* Donut chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4 text-primary" />
                Pipeline distribution
              </CardTitle>
              <CardDescription>{totalArticles} articles across {pipelineDonutData.length} active stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-full" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pipelineDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pipelineDonutData.map((entry) => (
                          <Cell
                            key={entry.id}
                            fill={PIPELINE_COLORS[entry.id] ?? '#94a3b8'}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-foreground">{totalArticles}</span>
                    <span className="text-xs text-muted-foreground">articles</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full text-xs">
                  {pipelineDonutData.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ background: PIPELINE_COLORS[entry.id] ?? '#94a3b8' }}
                      />
                      <span className="text-muted-foreground truncate">{entry.name}</span>
                      <span className="ml-auto font-medium text-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Area chart */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-primary" />
                Content activity
              </CardTitle>
              <CardDescription>Weekly articles produced and tasks completed (mock trend)</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ACTIVITY_TREND} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
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
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-500" />Articles</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Tasks</span>
              </div>
            </CardContent>
          </Card>
        </div>

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
              {MOCK_ARTICLES.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Stage: <span className="capitalize">{a.stage}</span> · Due {format(parseISO(a.publishDate), 'MMM d')}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    READINESS_CLASSES[a.readiness] ?? 'bg-muted text-muted-foreground'
                  )}>
                    {READINESS_LABELS[a.readiness] ?? a.readiness}
                  </span>
                </div>
              ))}
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
              <CardDescription>{DASHBOARD_STATS.pendingApprovals} pending — requires admin action</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_APPROVALS.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.requestedBy} · {a.entity}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    a.status === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                    a.status === 'approved' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                    a.status === 'rejected' && 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
                  )}>
                    {a.status}
                  </span>
                </div>
              ))}
              <Button variant="secondary" className="w-full" asChild>
                <Link href="/dashboard/approvals">Open full queue</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Calendar + Activity log ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* Upcoming calendar events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="size-4" />
                Upcoming schedule
              </CardTitle>
              <CardDescription>
                Publish dates, deadlines &amp; social. 7-day readiness rule from Milestone 6.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <span className={cn('size-2 rounded-full shrink-0', EVENT_DOT_CLASSES[ev.color] ?? 'bg-muted-foreground')} />
                  <div className="min-w-0 grow">
                    <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(ev.start), 'EEE, MMM d · h:mm a')}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    EVENT_COLOR_CLASSES[ev.color] ?? 'bg-muted text-muted-foreground'
                  )}>
                    {ev.source}
                  </span>
                </div>
              ))}
              <Button variant="link" size="sm" asChild className="px-0 h-auto">
                <Link href="/dashboard/calendar">Full calendar <ArrowRight className="size-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>

          {/* Activity log */}
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Last system events (real logs from Milestone 7)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_ACTIVITY.map((e) => (
                <div key={e.id} className="flex items-start gap-3">
                  <span className={cn('mt-1.5 size-2 rounded-full shrink-0', LOG_STATUS_CLASSES[e.status] ?? 'bg-muted-foreground')} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      <span className="text-muted-foreground font-normal">[{e.type}]</span>{' '}
                      {e.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.user} · {format(parseISO(e.at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
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
                Avg. score: {DASHBOARD_STATS.avgSeoScore} / 100 — real SEO analysis in Milestone 10
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {MOCK_SEO_ARTICLES.map((s) => (
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
                  <p className="text-xs text-muted-foreground">
                    Keyword: <span className="text-foreground">{s.keyword}</span> ·{' '}
                    {s.internalLinks} internal link{s.internalLinks !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
              <Button variant="link" asChild className="px-0 h-auto">
                <Link href="/dashboard/seo">SEO workspace <ArrowRight className="size-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>

          {/* Integrations with status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plug className="size-4" />
                Integrations
              </CardTitle>
              <CardDescription>All inactive in Milestone 1 — wired progressively M8–M10</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {MOCK_INTEGRATIONS.slice(0, 6).map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
                    <div className="grow min-w-0">
                      <p className="text-sm font-medium text-foreground">{i.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{i.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 font-mono bg-muted rounded px-1.5 py-0.5">
                      M{i.milestone}
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                <Link href="/dashboard/settings/integrations">
                  <Zap className="size-3 mr-1.5" /> Configure integrations
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </Container>
  );
}
