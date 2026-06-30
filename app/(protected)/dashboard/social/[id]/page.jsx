'use client';

import { useState, use, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  CalendarCheck,
  Instagram,
  Linkedin,
  Twitter,
  Share2,
  Image as ImageIcon,
  Hash,
  BarChart2,
  Check,
  AlertCircle,
  Play,
  Activity,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------
const PLATFORMS = [
  { id: 'instagram_carousel', label: 'IG Carousel', Icon: Instagram },
  { id: 'instagram_story', label: 'IG Story', Icon: Instagram },
  { id: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { id: 'twitter', label: 'Twitter', Icon: Twitter },
];

const STATUS_COLOR = {
  pending: 'secondary',
  content_generating: 'default',
  content_ready: 'outline',
  exporting: 'default',
  uploaded: 'outline',
  scheduling: 'default',
  scheduled: 'default',
  failed: 'destructive',
};

const STATUS_ICON = {
  pending: <Loader2 className="size-3 text-muted-foreground" />,
  content_generating: <Loader2 className="size-3 animate-spin" />,
  content_ready: <Check className="size-3 text-emerald-500" />,
  exporting: <Loader2 className="size-3 animate-spin" />,
  uploaded: <Check className="size-3 text-emerald-500" />,
  scheduling: <Loader2 className="size-3 animate-spin" />,
  scheduled: <CalendarCheck className="size-3 text-emerald-500" />,
  failed: <AlertCircle className="size-3 text-destructive" />,
};

// ---------------------------------------------------------------------------
// Post card
// ---------------------------------------------------------------------------
function PostCard({ post, onUpdate, onRegenerate, onExport, onPullAnalytics }) {
  const [editingCaption, setEditingCaption] = useState(false);
  const [caption, setCaption] = useState(post.generatedText || '');
  const [regenerateInstruction, setRegenerateInstruction] = useState('');
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);

  function saveCaption() {
    onUpdate(post.id, { generatedText: caption });
    setEditingCaption(false);
  }

  function handleRegenerate() {
    onRegenerate(post.id, regenerateInstruction || undefined);
    setShowRegeneratePrompt(false);
    setRegenerateInstruction('');
  }

  return (
    <Card className={post.status === 'failed' ? 'border-destructive/40' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-1">
            {post.article?.title || 'Unknown article'}
          </CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {STATUS_ICON[post.status]}
            <Badge variant={STATUS_COLOR[post.status] ?? 'secondary'} className="text-xs">
              {post.status?.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
        {post.scheduledAt && (
          <p className="text-xs text-muted-foreground">
            {format(parseISO(String(post.scheduledAt)), 'MMM d, yyyy h:mm a')}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Export progress */}
        {post.status === 'exporting' && post.exportTotal > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Exporting slides</span>
              <span>
                {post.exportProgress}/{post.exportTotal}
              </span>
            </div>
            <Progress value={(post.exportProgress / post.exportTotal) * 100} className="h-1.5" />
          </div>
        )}

        {/* Slide thumbnails */}
        {post.imageUrls?.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {post.imageUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Slide ${i + 1}`}
                className="h-20 w-14 shrink-0 object-cover rounded border"
              />
            ))}
          </div>
        )}

        {/* Caption */}
        {post.platform !== 'twitter' || post.generatedText ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Caption</p>
              {!editingCaption && post.generatedText && (
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => {
                    setCaption(post.generatedText || '');
                    setEditingCaption(true);
                  }}
                >
                  Edit
                </button>
              )}
            </div>
            {editingCaption ? (
              <div className="space-y-1">
                <Textarea
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="text-sm"
                />
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={saveCaption}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingCaption(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground line-clamp-3">
                {post.generatedText || <em>No caption yet</em>}
              </p>
            )}
          </div>
        ) : null}

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.hashtags.map((h) => (
              <span
                key={h}
                className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              >
                #{h}
              </span>
            ))}
          </div>
        )}

        {/* Error */}
        {post.errorMessage && (
          <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
            {post.errorMessage}
          </p>
        )}

        {/* Analytics */}
        {post.analyticsData && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs border rounded p-2">
            <div>
              <p className="font-medium">{post.analyticsData.impressions ?? '–'}</p>
              <p className="text-muted-foreground">Impressions</p>
            </div>
            <div>
              <p className="font-medium">{post.analyticsData.likes ?? '–'}</p>
              <p className="text-muted-foreground">Likes</p>
            </div>
            <div>
              <p className="font-medium">{post.analyticsData.clicks ?? '–'}</p>
              <p className="text-muted-foreground">Clicks</p>
            </div>
          </div>
        )}

        {/* Regenerate instruction prompt */}
        {showRegeneratePrompt && (
          <div className="space-y-2 rounded border p-2 bg-muted/40">
            <p className="text-xs font-medium">
              What should the agent change? (leave blank to regenerate)
            </p>
            <Textarea
              rows={2}
              className="text-xs"
              placeholder='e.g. "make it more concise" or "focus on the stat"'
              value={regenerateInstruction}
              onChange={(e) => setRegenerateInstruction(e.target.value)}
            />
            <div className="flex gap-1.5">
              <Button size="sm" onClick={handleRegenerate}>
                Send
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowRegeneratePrompt(false);
                  setRegenerateInstruction('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRegeneratePrompt((v) => !v)}
            disabled={post.status === 'content_generating' || post.status === 'scheduled'}
          >
            <RefreshCw className="size-3 mr-1" />
            Regenerate
          </Button>
          {post.status === 'content_ready' && (
            <Button size="sm" variant="outline" onClick={() => onExport(post.id)}>
              <Play className="size-3 mr-1" />
              Export
            </Button>
          )}
          {post.status === 'scheduled' && post.bufferPostId && (
            <Button size="sm" variant="ghost" onClick={() => onPullAnalytics(post.id)}>
              <BarChart2 className="size-3 mr-1" />
              Pull analytics
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Log step config
// ---------------------------------------------------------------------------
const STEP_LABEL = {
  pipeline_start:           'Pipeline started',
  pipeline_error:           'Pipeline error',
  pipeline_complete:        'Pipeline complete',
  approval_fetch:           'Fetching articles',
  approval_session:         'Approval agent session',
  approval_handoff:         'Injecting handoff context',
  approval_handoff_write:   'Writing handoff summary',
  approval_ai_send:         'Sending to approval agent',
  approval_posts_created:   'Posts created from approval',
  content_start:            'Content generation started',
  content_done:             'Content generation complete',
  content_session:          'Content agent session',
  content_ai_send:          'Sending to content agent',
  export_start:             'Exporting images',
  export_skip:              'Export skipped (Twitter)',
  schedule_buffer:          'Scheduling via Buffer',
  schedule_all_start:       'Scheduling all posts',
  schedule_all_done:        'All posts scheduled',
};

const STEP_ICON = {
  running: <Loader2 className="size-3.5 animate-spin text-blue-500 shrink-0" />,
  done:    <Check className="size-3.5 text-emerald-500 shrink-0" />,
  error:   <AlertCircle className="size-3.5 text-destructive shrink-0" />,
};

// ---------------------------------------------------------------------------
// Single log row
// ---------------------------------------------------------------------------
function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const hasData = log.input || log.output;

  return (
    <div className="border-l-2 pl-3 py-1 text-xs space-y-0.5"
      style={{ borderColor: log.status === 'error' ? 'hsl(var(--destructive))' : log.status === 'running' ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{STEP_ICON[log.status] ?? STEP_ICON.done}</span>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-foreground">
            {STEP_LABEL[log.step] ?? log.step}
          </span>
          {log.message && (
            <span className="ml-1.5 text-muted-foreground">{log.message}</span>
          )}
        </div>
        <span className="text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
        </span>
        {hasData && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        )}
      </div>

      {open && hasData && (
        <div className="mt-1 space-y-1">
          {log.input && (
            <details open className="group">
              <summary className="cursor-pointer text-muted-foreground select-none">Input</summary>
              <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                {JSON.stringify(log.input, null, 2)}
              </pre>
            </details>
          )}
          {log.output && (
            <details open className="group">
              <summary className="cursor-pointer text-muted-foreground select-none">Output</summary>
              <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                {JSON.stringify(log.output, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline logs panel
// ---------------------------------------------------------------------------
const ACTIVE_STATUSES = new Set(['pending', 'running', 'content_generating', 'exporting', 'scheduling']);

function PipelineLogs({ campaignId, campaignStatus }) {
  const isActive = ACTIVE_STATUSES.has(campaignStatus);
  const bottomRef = useRef(null);

  const { data: logs = [] } = useQuery({
    queryKey: ['social-campaign-logs', campaignId],
    queryFn: async () => {
      const res = await apiFetch(`/api/social/campaigns/${campaignId}/logs`);
      if (!res.ok) throw new Error('Failed to load logs');
      const j = await res.json();
      return j.data ?? [];
    },
    refetchInterval: isActive ? 2000 : false,
  });

  // Auto-scroll to bottom as new logs arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  if (!logs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Activity className="size-8 opacity-30" />
        <p className="text-sm">No pipeline logs yet. Logs appear as the pipeline runs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 font-mono">
      {logs.map((log) => (
        <LogRow key={log.id} log={log} />
      ))}
      {isActive && (
        <div className="flex items-center gap-2 pl-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Pipeline running — refreshing every 2s…
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SocialCampaignPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['social-campaign', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/social/campaigns/${id}`);
      if (!res.ok) throw new Error('Failed to load campaign');
      const j = await res.json();
      return j.data;
    },
    refetchInterval: (data) => {
      if (!data) return 5000;
      const running = data?.posts?.some(
        (p) =>
          p.status === 'content_generating' ||
          p.status === 'exporting' ||
          p.status === 'scheduling',
      );
      return running ? 3000 : 10000;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ postId, data }) => {
      const res = await apiFetch(`/api/social/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update post');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-campaign', id] }),
    onError: (e) => toast.error(e.message),
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ postId, instruction }) => {
      const res = await apiFetch(`/api/social/posts/${postId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      });
      if (!res.ok) throw new Error('Failed to regenerate');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-campaign', id] });
      toast.success('Regeneration started — session memory preserved');
    },
    onError: (e) => toast.error(e.message),
  });

  const exportMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await apiFetch(`/api/social/posts/${postId}/export`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start export');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-campaign', id] });
      toast.success('Export started');
    },
    onError: (e) => toast.error(e.message),
  });

  const analyticsMutation = useMutation({
    mutationFn: async (postId) => {
      const res = await apiFetch(`/api/social/posts/${postId}/analytics`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pull analytics');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-campaign', id] });
      toast.success('Analytics updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const scheduleAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/social/campaigns/${id}/schedule-all`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to schedule all');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-campaign', id] });
      toast.success(`Scheduled ${data.scheduled} posts`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <Container>
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </Container>
    );
  }

  if (!campaign) {
    return (
      <Container>
        <p className="text-sm text-muted-foreground">Campaign not found.</p>
      </Container>
    );
  }

  const postsByPlatform = {};
  for (const p of campaign.posts ?? []) {
    if (!postsByPlatform[p.platform]) postsByPlatform[p.platform] = [];
    postsByPlatform[p.platform].push(p);
  }

  const uploadedPosts = (campaign.posts ?? []).filter((p) => p.status === 'uploaded');
  const canScheduleAll = uploadedPosts.length > 0;

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/social')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            Week of {format(parseISO(String(campaign.weekStart)), 'MMM d')} –{' '}
            {format(parseISO(String(campaign.weekEnd)), 'MMM d, yyyy')}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge
              variant={
                campaign.status === 'done'
                  ? 'default'
                  : campaign.status === 'failed'
                    ? 'destructive'
                    : 'secondary'
              }
            >
              {campaign.status}
            </Badge>
            {campaign.campaignBrief && (
              <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                {campaign.campaignBrief}
              </span>
            )}
          </div>
        </div>
        {canScheduleAll && (
          <Button onClick={() => scheduleAllMutation.mutate()} disabled={scheduleAllMutation.isPending}>
            {scheduleAllMutation.isPending ? (
              <Loader2 className="size-4 mr-1.5 animate-spin" />
            ) : (
              <CalendarCheck className="size-4 mr-1.5" />
            )}
            Schedule All ({uploadedPosts.length})
          </Button>
        )}
      </div>

      {/* Platform + Logs tabs */}
      <Tabs defaultValue="instagram_carousel">
        <TabsList className="mb-4">
          {PLATFORMS.map((p) => {
            const count = postsByPlatform[p.id]?.length ?? 0;
            return (
              <TabsTrigger key={p.id} value={p.id} className="gap-1.5">
                <p.Icon className="size-3.5" />
                {p.label}
                {count > 0 && (
                  <span className="ml-0.5 text-xs bg-muted rounded-full px-1.5">{count}</span>
                )}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="logs" className="gap-1.5">
            <Activity className="size-3.5" />
            Logs
            {ACTIVE_STATUSES.has(campaign.status) && (
              <span className="ml-0.5 size-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        {PLATFORMS.map((platform) => {
          const posts = postsByPlatform[platform.id] ?? [];
          return (
            <TabsContent key={platform.id} value={platform.id}>
              {posts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No posts for this platform in this campaign.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onUpdate={(postId, data) =>
                        updateMutation.mutate({ postId, data })
                      }
                      onRegenerate={(postId, instruction) =>
                        regenerateMutation.mutate({ postId, instruction })
                      }
                      onExport={(postId) => exportMutation.mutate(postId)}
                      onPullAnalytics={(postId) => analyticsMutation.mutate(postId)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}

        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="size-4" />
                Pipeline Run Log
                {ACTIVE_STATUSES.has(campaign.status) && (
                  <Badge variant="default" className="text-xs gap-1">
                    <Loader2 className="size-2.5 animate-spin" />
                    Live
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              <PipelineLogs campaignId={id} campaignStatus={campaign.status} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Container>
  );
}
