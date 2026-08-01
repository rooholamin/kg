'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardHeading, CardTitle, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import { videoPlatformConfig } from '@/lib/video-platforms';
import { CreateCustomVideoDialog } from '@/components/video/create-custom-video-dialog';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Upload,
  CalendarClock,
  Square,
  Pause,
  Play,
  ClapperboardIcon,
  RotateCw,
  ScrollText,
  Clock,
  DollarSign,
  ChevronRight,
  Layers,
  CheckCircle2,
  Plus,
} from 'lucide-react';

const CAMPAIGN_STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400', dot: 'bg-zinc-400' },
  running: { label: 'Running', className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500 animate-pulse' },
  approving: { label: 'Approving', className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500 animate-pulse' },
  directing: { label: 'Directing', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', dot: 'bg-indigo-500 animate-pulse' },
  exporting: { label: 'Exporting', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', dot: 'bg-indigo-500 animate-pulse' },
  reviewing: { label: 'Review', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  scheduling: { label: 'Scheduling', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500 animate-pulse' },
  paused: { label: 'Paused', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400', dot: 'bg-zinc-400' },
  done: { label: 'Done', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400', dot: 'bg-zinc-400' },
};

const POST_STATUS_BADGE = {
  pending: { variant: 'secondary', appearance: 'light' },
  planning: { variant: 'info', appearance: 'light' },
  plan_ready: { variant: 'info', appearance: 'light' },
  approved: { variant: 'info', appearance: 'light' },
  directing: { variant: 'info', appearance: 'light' },
  content_ready: { variant: 'success', appearance: 'light' },
  exporting: { variant: 'info', appearance: 'light' },
  uploaded: { variant: 'success', appearance: 'light' },
  scheduling: { variant: 'warning', appearance: 'light' },
  scheduled: { variant: 'success', appearance: 'light' },
  failed: { variant: 'destructive', appearance: 'light' },
};

function StatusPill({ status }) {
  const cfg = CAMPAIGN_STATUS_CONFIG[status] ?? CAMPAIGN_STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${cfg.className}`}>
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatMs(ms) {
  if (!ms) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="flex items-center gap-3 bg-card border rounded-xl p-3.5">
      <div className={`size-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`size-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-none truncate">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function VideoPostSummaryCard({ post }) {
  const router = useRouter();
  const segments = post.segments || [];
  const completedCount = segments.filter((s) => s.status === 'completed').length;
  const progressPct = segments.length > 0 ? Math.round((completedCount / segments.length) * 100) : 0;
  const badgeCfg = POST_STATUS_BADGE[post.status] ?? { variant: 'secondary', appearance: 'light' };

  return (
    <Card
      className="cursor-pointer group overflow-hidden hover:shadow-md hover:border-primary/40 transition-all duration-200"
      onClick={() => router.push(`/dashboard/video/posts/${post.id}`)}
    >
      <div className="relative bg-black h-52 flex items-center justify-center overflow-hidden">
        {post.videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={post.videoUrl} controls className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />
        ) : (
          <ClapperboardIcon className="size-8 text-white/20" />
        )}
        <Badge variant={badgeCfg.variant} appearance={badgeCfg.appearance} size="sm" className="absolute top-2 left-2 shadow-sm">
          {post.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <CardContent className="p-4 space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{post.article?.title || post.customTitle || 'Untitled video'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {segments.length > 0 ? `${completedCount}/${segments.length} segments generated` : 'No plan yet'}
          </p>
        </div>

        {segments.length > 0 && <Progress value={progressPct} className="h-1" />}

        {post.errorMessage ? (
          <p className="text-xs text-destructive bg-destructive/5 border border-destructive/10 rounded-md p-2 line-clamp-2">
            {post.errorMessage}
          </p>
        ) : post.narration ? (
          <p className="text-xs italic text-muted-foreground line-clamp-2">&ldquo;{post.narration}&rdquo;</p>
        ) : null}

        {(post.platforms?.length > 0 || post.scheduledAt) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {post.platforms?.map((key) => {
              const cfg = videoPlatformConfig(key);
              if (!cfg) return null;
              const { Icon } = cfg;
              return (
                <span key={key} className={`inline-flex items-center justify-center size-5 rounded-full ${cfg.bg}`} title={cfg.label}>
                  <Icon className={`size-3 ${cfg.color}`} />
                </span>
              );
            })}
            {post.scheduledAt && (
              <span className="text-xs text-muted-foreground">{format(new Date(post.scheduledAt), 'MMM d, h:mm a')}</span>
            )}
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="size-3" />{formatMs(post.totalGenerationTimeMs)}</span>
          <span className="flex items-center gap-1"><DollarSign className="size-3" />{post.totalEstimatedCost ? `~$${post.totalEstimatedCost.toFixed(2)}` : '—'}</span>
          <span className="flex items-center gap-0.5 text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View <ChevronRight className="size-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function RunLogPanel({ campaignId }) {
  const { data: logs = [] } = useQuery({
    queryKey: ['video-campaign-logs', campaignId],
    queryFn: async () => {
      const res = await apiFetch(`/api/video/campaigns/${campaignId}/logs`);
      if (!res.ok) return [];
      const j = await res.json();
      return j.data ?? [];
    },
    refetchInterval: 5000,
  });

  const sorted = logs.slice().reverse();

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <CardHeading>
          <CardTitle className="text-sm flex items-center gap-2">
            <ScrollText className="size-4 text-muted-foreground" />
            Run Log
          </CardTitle>
        </CardHeading>
        <CardToolbar>
          <Badge variant="secondary" appearance="light" size="sm">{logs.length}</Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent>
        <div className="max-h-[32rem] overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No log entries yet.</p>
          ) : (
            sorted.map((log, i) => {
              const dotColor = log.status === 'error' ? 'bg-red-500' : log.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500';
              return (
                <div key={log.id} className="relative pl-5 pb-4 last:pb-0">
                  {i !== sorted.length - 1 && (
                    <span className="absolute left-[3px] top-2.5 bottom-0 w-px bg-border" />
                  )}
                  <span className={`absolute left-0 top-1 size-2 rounded-full ring-4 ring-card ${dotColor}`} />
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium">{log.step}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0 font-mono">{format(new Date(log.createdAt), 'HH:mm:ss')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{log.message}</p>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VideoCampaignDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showLog, setShowLog] = useState(false);
  const [createCustomOpen, setCreateCustomOpen] = useState(false);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['video-campaign', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/video/campaigns/${id}`);
      if (!res.ok) throw new Error('Failed to load campaign');
      const j = await res.json();
      return j.data;
    },
    refetchInterval: 8000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['video-campaign', id] });

  const actionMutation = useMutation({
    mutationFn: async (action) => {
      const res = await apiFetch(`/api/video/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Action failed');
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: async (endpoint) => {
      const res = await apiFetch(`/api/video/campaigns/${id}/${endpoint}`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Action failed');
      }
      return res.json();
    },
    onSuccess: (data, endpoint) => {
      toast.success(`${endpoint.replace(/-/g, ' ')} started`);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const posts = campaign?.posts ?? [];
  const counts = useMemo(() => {
    const c = {};
    for (const p of posts) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [posts]);
  const totals = useMemo(() => {
    let cost = 0;
    let timeMs = 0;
    let scheduled = 0;
    for (const p of posts) {
      cost += p.totalEstimatedCost || 0;
      timeMs += p.totalGenerationTimeMs || 0;
      if (p.status === 'scheduled') scheduled++;
    }
    return { cost, timeMs, scheduled };
  }, [posts]);

  if (isLoading) {
    return (
      <Container>
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      </Container>
    );
  }

  if (!campaign) {
    return <Container><p className="text-sm text-muted-foreground py-12 text-center">Campaign not found.</p></Container>;
  }

  return (
    <Container>
      <div className="flex items-start gap-3 mb-5">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/video')} className="mt-0.5">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Video Campaign</p>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold">
              {format(new Date(campaign.weekStart), 'MMM d')} – {format(new Date(campaign.weekEnd), 'MMM d, yyyy')}
            </h1>
            <StatusPill status={campaign.status} />
          </div>
          {campaign.campaignBrief && (
            <p className="text-sm text-muted-foreground mt-1 italic max-w-2xl">&ldquo;{campaign.campaignBrief}&rdquo;</p>
          )}
          {posts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {Object.entries(counts).map(([status, n]) => {
                const cfg = POST_STATUS_BADGE[status] ?? { variant: 'secondary', appearance: 'light' };
                return (
                  <Badge key={status} variant={cfg.variant} appearance={cfg.appearance} size="sm">
                    {n} {status.replace(/_/g, ' ')}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {posts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard icon={Layers} label="Videos" value={posts.length} color="text-purple-600" bg="bg-purple-500/10" />
          <StatCard icon={CheckCircle2} label="Scheduled" value={`${totals.scheduled}/${posts.length}`} color="text-emerald-600" bg="bg-emerald-500/10" />
          <StatCard icon={Clock} label="Total Time" value={formatMs(totals.timeMs)} color="text-blue-600" bg="bg-blue-500/10" />
          <StatCard icon={DollarSign} label="Total Cost" value={totals.cost > 0 ? `~$${totals.cost.toFixed(2)}` : '—'} color="text-amber-600" bg="bg-amber-500/10" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-6 p-2 rounded-xl bg-muted/40 border border-border/60">
        <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('regenerate-all')} disabled={bulkMutation.isPending}>
          <RefreshCw className="size-3.5" /> Re-plan All
        </Button>
        <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('export-all')} disabled={bulkMutation.isPending}>
          <Upload className="size-3.5" /> Export All
        </Button>
        <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('retry-failed')} disabled={bulkMutation.isPending}>
          <RotateCw className="size-3.5" /> Retry Failed
        </Button>
        <Separator orientation="vertical" className="h-5 mx-0.5 hidden sm:block" />
        <Button size="sm" onClick={() => bulkMutation.mutate('schedule-all')} disabled={bulkMutation.isPending}>
          <CalendarClock className="size-3.5" /> Schedule All
        </Button>
        <Separator orientation="vertical" className="h-5 mx-0.5 hidden sm:block" />
        <Button size="sm" variant="outline" onClick={() => setCreateCustomOpen(true)}>
          <Plus className="size-3.5" /> Custom Video
        </Button>

        <div className="flex-1" />

        {campaign.status === 'paused' ? (
          <Button size="sm" variant="outline" onClick={() => actionMutation.mutate('resume')} disabled={actionMutation.isPending}>
            <Play className="size-3.5" /> Resume
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => actionMutation.mutate('pause')} disabled={actionMutation.isPending}>
            <Pause className="size-3.5" /> Pause
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={() => actionMutation.mutate('stop')} disabled={actionMutation.isPending}>
          <Square className="size-3.5" /> Stop
        </Button>
        <Separator orientation="vertical" className="h-5 mx-0.5 hidden sm:block" />
        <Button size="sm" variant={showLog ? 'secondary' : 'ghost'} onClick={() => setShowLog((v) => !v)}>
          <ScrollText className="size-3.5" /> {showLog ? 'Hide' : 'Show'} Log
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className={showLog ? 'lg:col-span-2 space-y-4' : 'lg:col-span-3 space-y-4'}>
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 border-2 border-dashed rounded-xl">
              <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
                <ClapperboardIcon className="size-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">No videos approved yet</p>
                <p className="text-sm text-muted-foreground mt-1">The pipeline may still be running the approval step.</p>
              </div>
            </div>
          ) : (
            <div className={`grid sm:grid-cols-2 gap-4 ${showLog ? '' : '2xl:grid-cols-3'}`}>
              {posts.map((post) => <VideoPostSummaryCard key={post.id} post={post} />)}
            </div>
          )}
        </div>
        {showLog && (
          <div className="lg:col-span-1">
            <RunLogPanel campaignId={id} />
          </div>
        )}
      </div>

      <CreateCustomVideoDialog
        open={createCustomOpen}
        onOpenChange={setCreateCustomOpen}
        endpoint={`/api/video/campaigns/${id}/custom-posts`}
        onCreated={() => invalidate()}
      />
    </Container>
  );
}
