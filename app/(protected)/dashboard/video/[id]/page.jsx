'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
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
} from 'lucide-react';

const STATUS_BADGE = {
  pending: 'secondary',
  planning: 'default',
  plan_ready: 'default',
  approved: 'default',
  directing: 'default',
  content_ready: 'default',
  exporting: 'default',
  uploaded: 'default',
  scheduling: 'default',
  scheduled: 'default',
  failed: 'destructive',
};

function formatMs(ms) {
  if (!ms) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function VideoPostSummaryCard({ post, campaignId }) {
  const router = useRouter();
  const segments = post.segments || [];
  const completedCount = segments.filter((s) => s.status === 'completed').length;

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => router.push(`/dashboard/video/posts/${post.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm truncate">{post.article?.title || 'Untitled article'}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {segments.length > 0 ? `${completedCount}/${segments.length} segments` : 'No plan yet'}
            </p>
          </div>
          <Badge variant={STATUS_BADGE[post.status] ?? 'secondary'} className="shrink-0">
            {post.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {post.videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={post.videoUrl} controls className="w-full max-w-xs mx-auto rounded-lg bg-black" onClick={(e) => e.stopPropagation()} />
        ) : (
          <div className="flex items-center justify-center h-40 bg-muted rounded-lg">
            <ClapperboardIcon className="size-6 text-muted-foreground/40" />
          </div>
        )}

        {post.errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-2 line-clamp-2">{post.errorMessage}</p>
        )}

        {post.narration && (
          <p className="text-xs italic text-muted-foreground line-clamp-2">&ldquo;{post.narration}&rdquo;</p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="size-3" />{formatMs(post.totalGenerationTimeMs)}</span>
          <span className="flex items-center gap-1"><DollarSign className="size-3" />{post.totalEstimatedCost ? `~$${post.totalEstimatedCost.toFixed(2)}` : '—'}</span>
          <span className="flex items-center gap-0.5 text-primary">View <ChevronRight className="size-3" /></span>
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

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Run Log</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {logs.length === 0 && <p className="text-xs text-muted-foreground">No log entries yet.</p>}
          {logs.slice().reverse().map((log) => (
            <div key={log.id} className="text-xs flex items-start gap-2 py-1 border-b last:border-0">
              <span className={`size-1.5 rounded-full mt-1 shrink-0 ${
                log.status === 'error' ? 'bg-red-500' : log.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'
              }`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{log.step}</p>
                <p className="text-muted-foreground truncate">{log.message}</p>
              </div>
              <span className="text-muted-foreground shrink-0">{format(new Date(log.createdAt), 'HH:mm:ss')}</span>
            </div>
          ))}
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
    for (const p of posts) {
      cost += p.totalEstimatedCost || 0;
      timeMs += p.totalGenerationTimeMs || 0;
    }
    return { cost, timeMs };
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
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/video')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            {format(new Date(campaign.weekStart), 'MMM d')} – {format(new Date(campaign.weekEnd), 'MMM d, yyyy')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {posts.length} video{posts.length !== 1 ? 's' : ''} · {Object.entries(counts).map(([s, n]) => `${n} ${s.replace(/_/g, ' ')}`).join(', ') || 'no posts yet'}
            {(totals.cost > 0 || totals.timeMs > 0) && (
              <>
                {' '}· <Clock className="inline size-3 -mt-0.5" /> {formatMs(totals.timeMs)}
                {' '}· <DollarSign className="inline size-3 -mt-0.5" /> ~${totals.cost.toFixed(2)}
              </>
            )}
          </p>
        </div>
        <Badge>{campaign.status.replace(/_/g, ' ')}</Badge>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('regenerate-all')}>
          <RefreshCw className="size-3.5 mr-1.5" /> Re-plan All
        </Button>
        <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('export-all')}>
          <Upload className="size-3.5 mr-1.5" /> Export All
        </Button>
        <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('retry-failed')}>
          <RotateCw className="size-3.5 mr-1.5" /> Retry Failed
        </Button>
        <Button size="sm" onClick={() => bulkMutation.mutate('schedule-all')}>
          <CalendarClock className="size-3.5 mr-1.5" /> Schedule All
        </Button>
        <div className="flex-1" />
        {campaign.status === 'paused' ? (
          <Button size="sm" variant="outline" onClick={() => actionMutation.mutate('resume')}>
            <Play className="size-3.5 mr-1.5" /> Resume
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => actionMutation.mutate('pause')}>
            <Pause className="size-3.5 mr-1.5" /> Pause
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={() => actionMutation.mutate('stop')}>
          <Square className="size-3.5 mr-1.5" /> Stop
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowLog((v) => !v)}>
          <ScrollText className="size-3.5 mr-1.5" /> {showLog ? 'Hide' : 'Show'} Log
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className={showLog ? 'lg:col-span-2 space-y-4' : 'lg:col-span-3 space-y-4'}>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No videos approved yet — the pipeline may still be running the approval step.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {posts.map((post) => <VideoPostSummaryCard key={post.id} post={post} campaignId={id} />)}
            </div>
          )}
        </div>
        {showLog && (
          <div className="lg:col-span-1">
            <RunLogPanel campaignId={id} />
          </div>
        )}
      </div>
    </Container>
  );
}
