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
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  ChevronDown,
  ClapperboardIcon,
  TrendingUp,
  XCircle,
  RotateCw,
  ScrollText,
} from 'lucide-react';

const STATUS_BADGE = {
  pending: 'secondary',
  directing: 'default',
  content_ready: 'default',
  exporting: 'default',
  uploaded: 'default',
  scheduling: 'default',
  scheduled: 'default',
  failed: 'destructive',
};

function VideoPostCard({ post, campaignId }) {
  const queryClient = useQueryClient();
  const [directorNote, setDirectorNote] = useState(post.directorNote || '');
  const [showShotList, setShowShotList] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['video-campaign', campaignId] });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directorNote: directorNote || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Regeneration failed');
      }
      return res.json();
    },
    onSuccess: () => { toast.success('Video regenerated'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/export`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start export');
    },
    onSuccess: () => { toast.success('Export started'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/schedule`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to schedule');
      }
    },
    onSuccess: () => { toast.success('Scheduled via Buffer'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const unscheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/unschedule`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to unschedule');
    },
    onSuccess: () => { toast.success('Removed from Buffer'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const analyticsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/analytics`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pull analytics');
      return res.json();
    },
    onSuccess: () => { toast.success('Analytics updated'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm truncate">{post.article?.title || 'Untitled article'}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {post.duration ? `${post.duration}s` : '—'} · {post.aspectRatio || '—'} · {post.genre || '—'}
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
          <video
            src={post.videoUrl}
            poster={post.stillAssetUrl || undefined}
            controls
            className="w-full max-w-xs mx-auto rounded-lg bg-black"
          />
        ) : post.stillAssetUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.stillAssetUrl} alt="Directed start frame" className="w-full max-w-xs mx-auto rounded-lg" />
        ) : (
          <div className="flex items-center justify-center h-40 bg-muted rounded-lg">
            <ClapperboardIcon className="size-6 text-muted-foreground/40" />
          </div>
        )}

        {post.errorMessage && (
          <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-2">{post.errorMessage}</p>
        )}

        {post.narration && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Narration (spoken, lip-synced)</p>
            <p className="text-xs bg-muted rounded-lg p-2 italic">&ldquo;{post.narration}&rdquo;</p>
          </div>
        )}

        <Textarea
          value={post.generatedText || ''}
          readOnly
          rows={3}
          className="text-xs"
          placeholder="Caption will appear here once directed"
        />

        {post.hashtags?.length > 0 && (
          <p className="text-xs text-muted-foreground">{post.hashtags.join(' ')}</p>
        )}

        {post.shotList?.length > 0 && (
          <Collapsible open={showShotList} onOpenChange={setShowShotList}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown className={`size-3.5 transition-transform ${showShotList ? 'rotate-180' : ''}`} />
                Shot list ({post.shotList.length})
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 mt-2">
              {post.shotList.map((shot, i) => (
                <div key={i} className="text-xs border rounded-lg p-2 space-y-0.5">
                  <p className="font-mono text-muted-foreground">{shot.timestamp}</p>
                  <p><span className="font-medium">Camera:</span> {shot.camera}</p>
                  <p><span className="font-medium">Action:</span> {shot.action}</p>
                  {shot.lighting && <p><span className="font-medium">Lighting:</span> {shot.lighting}</p>}
                  {shot.sound && <p><span className="font-medium">Sound:</span> {shot.sound}</p>}
                  {/* `sound` is legacy — current shotList entries have no audio field, since all audio now comes from the narration/lip-sync pass */}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <Textarea
          value={directorNote}
          onChange={(e) => setDirectorNote(e.target.value)}
          placeholder="Director note for the next regenerate (optional)…"
          rows={2}
          className="text-xs"
        />

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
            {regenerateMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <RefreshCw className="size-3.5 mr-1" />}
            Regenerate
          </Button>
          {post.videoUrl && post.status !== 'uploaded' && post.status !== 'scheduled' && (
            <Button size="sm" variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
              Export
            </Button>
          )}
          {post.status === 'uploaded' && (
            <Button size="sm" onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <CalendarClock className="size-3.5 mr-1" />}
              Send to Buffer
            </Button>
          )}
          {post.bufferPostIds && Object.keys(post.bufferPostIds).length > 0 && (
            <Button size="sm" variant="outline" onClick={() => unscheduleMutation.mutate()} disabled={unscheduleMutation.isPending}>
              <XCircle className="size-3.5 mr-1" />
              Unschedule
            </Button>
          )}
          {post.status === 'scheduled' && (
            <Button size="sm" variant="outline" onClick={() => analyticsMutation.mutate()} disabled={analyticsMutation.isPending}>
              <TrendingUp className="size-3.5 mr-1" />
              Analytics
            </Button>
          )}
        </div>

        {post.analyticsData && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            {Object.entries(post.analyticsData).filter(([k]) => k !== 'pulledAt').map(([platform, m]) => (
              <div key={platform} className="border rounded-lg p-2">
                <p className="font-medium">{platform.replace(/_/g, ' ')}</p>
                <p className="text-muted-foreground">{m.impressions ?? 0} impressions · {m.likes ?? 0} likes</p>
              </div>
            ))}
          </div>
        )}

        <Collapsible open={showLog} onOpenChange={setShowLog}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ScrollText className="size-3.5" />
              Session: {post.directorSessionId ? post.directorSessionId.slice(0, 12) + '…' : 'not started'}
            </button>
          </CollapsibleTrigger>
        </Collapsible>
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
          </p>
        </div>
        <Badge>{campaign.status.replace(/_/g, ' ')}</Badge>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('regenerate-all')}>
          <RefreshCw className="size-3.5 mr-1.5" /> Regenerate All
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
              {posts.map((post) => <VideoPostCard key={post.id} post={post} campaignId={id} />)}
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
