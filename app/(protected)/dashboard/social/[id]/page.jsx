'use client';

import { useState, use, useEffect, useRef, useMemo } from 'react';
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
  BarChart2,
  Check,
  AlertCircle,
  Play,
  Activity,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Eye,
  Pencil,
  Hash,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
  Heart,
  MousePointerClick,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------
const PLATFORMS = [
  {
    id: 'instagram_carousel',
    label: 'IG Carousel',
    Icon: Instagram,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
    tabBg: 'data-[state=active]:bg-pink-50 dark:data-[state=active]:bg-pink-900/20',
  },
  {
    id: 'instagram_story',
    label: 'IG Story',
    Icon: Instagram,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    tabBg: 'data-[state=active]:bg-purple-50 dark:data-[state=active]:bg-purple-900/20',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    Icon: Linkedin,
    color: 'text-blue-600',
    bg: 'bg-blue-600/10',
    tabBg: 'data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-900/20',
  },
  {
    id: 'twitter',
    label: 'Twitter',
    Icon: Twitter,
    color: 'text-zinc-700 dark:text-zinc-300',
    bg: 'bg-zinc-500/10',
    tabBg: 'data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800',
  },
];

// ---------------------------------------------------------------------------
// Post status config
// ---------------------------------------------------------------------------
const POST_STATUS = {
  pending: {
    label: 'Pending',
    icon: <Clock className="size-3" />,
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
  content_generating: {
    label: 'Generating',
    icon: <Loader2 className="size-3 animate-spin" />,
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  content_ready: {
    label: 'Ready',
    icon: <CheckCircle2 className="size-3" />,
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  exporting: {
    label: 'Exporting',
    icon: <Loader2 className="size-3 animate-spin" />,
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  uploaded: {
    label: 'Uploaded',
    icon: <CheckCircle2 className="size-3" />,
    className: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  },
  scheduling: {
    label: 'Scheduling',
    icon: <Loader2 className="size-3 animate-spin" />,
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  scheduled: {
    label: 'Scheduled',
    icon: <CalendarCheck className="size-3" />,
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  failed: {
    label: 'Failed',
    icon: <XCircle className="size-3" />,
    className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

function PostStatusBadge({ status }) {
  const cfg = POST_STATUS[status] ?? POST_STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Post card
// ---------------------------------------------------------------------------
function PostCard({ post, onUpdate, onRegenerate, onExport, onPullAnalytics }) {
  const [editingCaption, setEditingCaption] = useState(false);
  const [caption, setCaption] = useState(post.generatedText || '');
  const [captionExpanded, setCaptionExpanded] = useState(false);
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

  const isProcessing =
    post.status === 'content_generating' ||
    post.status === 'exporting' ||
    post.status === 'scheduling';

  return (
    <Card className={`overflow-hidden transition-all duration-200 ${post.status === 'failed' ? 'border-red-200 dark:border-red-900/50' : ''}`}>
      {/* Card top accent bar */}
      <div className={`h-0.5 w-full ${
        post.status === 'scheduled' ? 'bg-emerald-500' :
        post.status === 'failed' ? 'bg-red-500' :
        isProcessing ? 'bg-blue-500' :
        post.status === 'uploaded' ? 'bg-violet-500' :
        'bg-border'
      }`} />

      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug line-clamp-2 flex-1">
            {post.article?.title || 'Unknown article'}
          </p>
          <PostStatusBadge status={post.status} />
        </div>

        {post.scheduledAt && (
          <div className="flex items-center gap-1.5 mt-1">
            <CalendarCheck className="size-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {format(parseISO(String(post.scheduledAt)), 'MMM d, yyyy · h:mm a')}
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        {/* Export progress */}
        {post.status === 'exporting' && post.exportTotal > 0 && (
          <div className="space-y-1.5 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/30">
            <div className="flex justify-between text-xs font-medium text-amber-700 dark:text-amber-400">
              <span>Exporting slides…</span>
              <span>{post.exportProgress}/{post.exportTotal}</span>
            </div>
            <Progress value={(post.exportProgress / post.exportTotal) * 100} className="h-1.5" />
          </div>
        )}

        {/* Slide thumbnails */}
        {post.imageUrls?.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="size-3" />
              <span>{post.imageUrls.length} slide{post.imageUrls.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {post.imageUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Slide ${i + 1}`}
                  className="h-24 w-[68px] shrink-0 object-cover rounded-lg border ring-1 ring-border"
                />
              ))}
            </div>
          </div>
        )}

        {/* Caption */}
        {(post.platform !== 'twitter' || post.generatedText) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Caption</span>
              {!editingCaption && post.generatedText && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  onClick={() => {
                    setCaption(post.generatedText || '');
                    setEditingCaption(true);
                  }}
                >
                  <Pencil className="size-3" />
                  Edit
                </button>
              )}
            </div>

            {editingCaption ? (
              <div className="space-y-2">
                <Textarea
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="text-sm resize-none"
                />
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={saveCaption}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingCaption(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className={`text-xs text-muted-foreground leading-relaxed ${captionExpanded ? '' : 'line-clamp-3'}`}>
                  {post.generatedText || <em>No caption yet</em>}
                </p>
                {post.generatedText && post.generatedText.length > 180 && (
                  <button
                    type="button"
                    className="text-xs text-primary mt-0.5 hover:underline"
                    onClick={() => setCaptionExpanded((v) => !v)}
                  >
                    {captionExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Hash className="size-3" />
              <span>{post.hashtags.length} hashtags</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {post.hashtags.map((h) => (
                <span
                  key={h}
                  className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                >
                  #{h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {post.errorMessage && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
            <AlertCircle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
              {post.errorMessage}
            </p>
          </div>
        )}

        {/* Analytics */}
        {post.analyticsData && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Impressions', value: post.analyticsData.impressions, icon: Eye },
              { label: 'Likes', value: post.analyticsData.likes, icon: Heart },
              { label: 'Clicks', value: post.analyticsData.clicks, icon: MousePointerClick },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-muted/60 rounded-lg p-2 text-center">
                <Icon className="size-3.5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-semibold">{value ?? '–'}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Regenerate instruction prompt */}
        {showRegeneratePrompt && (
          <div className="space-y-2 rounded-xl border p-3 bg-muted/40">
            <p className="text-xs font-medium">What should the agent change?</p>
            <Textarea
              rows={2}
              className="text-xs resize-none"
              placeholder='e.g. "make it more concise" or "focus on the stat"'
              value={regenerateInstruction}
              onChange={(e) => setRegenerateInstruction(e.target.value)}
            />
            <div className="flex gap-1.5">
              <Button size="sm" onClick={handleRegenerate}>
                <Sparkles className="size-3 mr-1" />
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
        <div className="flex flex-wrap gap-1.5 pt-1 border-t">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setShowRegeneratePrompt((v) => !v)}
            disabled={post.status === 'content_generating' || post.status === 'scheduled'}
          >
            <RefreshCw className="size-3 mr-1" />
            Regenerate
          </Button>
          {(post.status === 'content_ready' || post.status === 'failed' || post.status === 'exporting') && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onExport(post.id)}>
              <Play className="size-3 mr-1" />
              {post.status === 'content_ready' ? 'Export' : 'Retry Export'}
            </Button>
          )}
          {post.status === 'scheduled' && post.bufferPostId && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onPullAnalytics(post.id)}>
              <BarChart2 className="size-3 mr-1" />
              Pull Analytics
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

function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const hasData = log.input || log.output;

  const statusColor = {
    running: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10',
    done: 'border-l-emerald-500 bg-transparent',
    error: 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10',
  }[log.status] ?? 'border-l-border bg-transparent';

  const StatusIcon = {
    running: <Loader2 className="size-3.5 animate-spin text-blue-500 shrink-0 mt-0.5" />,
    done: <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />,
    error: <AlertCircle className="size-3.5 text-red-500 shrink-0 mt-0.5" />,
  }[log.status] ?? <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />;

  return (
    <div className={`border-l-2 pl-3 py-1.5 rounded-r text-xs ${statusColor}`}>
      <div className="flex items-start gap-2">
        {StatusIcon}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-foreground">
            {STEP_LABEL[log.step] ?? log.step}
          </span>
          {log.message && (
            <span className="ml-1.5 text-muted-foreground">{log.message}</span>
          )}
        </div>
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
        </span>
        {hasData && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        )}
      </div>

      {open && hasData && (
        <div className="mt-2 space-y-1.5 ml-5">
          {log.input && (
            <details open className="group">
              <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground transition-colors">
                Input
              </summary>
              <pre className="mt-1 text-xs bg-muted rounded-lg p-2.5 overflow-x-auto max-h-48 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(log.input, null, 2)}
              </pre>
            </details>
          )}
          {log.output && (
            <details open className="group">
              <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground transition-colors">
                Output
              </summary>
              <pre className="mt-1 text-xs bg-muted rounded-lg p-2.5 overflow-x-auto max-h-48 whitespace-pre-wrap break-all leading-relaxed">
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  if (!logs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
          <Activity className="size-5 opacity-40" />
        </div>
        <p className="text-sm">No pipeline logs yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 font-mono">
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
// Campaign status banner
// ---------------------------------------------------------------------------
const CAMPAIGN_STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', dot: 'bg-zinc-400' },
  running: { label: 'Running', className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500 animate-pulse' },
  reviewing: { label: 'Awaiting Review', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  done: { label: 'Complete', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
};

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
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading campaign…</p>
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

  const allPosts = campaign.posts ?? [];
  const uploadedPosts = allPosts.filter((p) => p.status === 'uploaded');
  const scheduledPosts = allPosts.filter((p) => p.status === 'scheduled');
  const failedPosts = allPosts.filter((p) => p.status === 'failed');
  const canScheduleAll = uploadedPosts.length > 0;

  const statusCfg = CAMPAIGN_STATUS_CONFIG[campaign.status] ?? CAMPAIGN_STATUS_CONFIG.pending;

  return (
    <Container>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => router.push('/dashboard/social')}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Social Media</span>
          <ChevronRight className="size-3.5 text-muted-foreground" />
          <span className="text-sm text-foreground font-medium">Campaign</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {format(parseISO(String(campaign.weekStart)), 'MMM d')} –{' '}
              {format(parseISO(String(campaign.weekEnd)), 'MMM d, yyyy')}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.className}`}>
                <span className={`size-1.5 rounded-full ${statusCfg.dot}`} />
                {statusCfg.label}
              </span>
              {campaign.campaignBrief && (
                <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs italic">
                  &ldquo;{campaign.campaignBrief}&rdquo;
                </span>
              )}
            </div>
          </div>

          {canScheduleAll && (
            <Button
              onClick={() => scheduleAllMutation.mutate()}
              disabled={scheduleAllMutation.isPending}
              className="shrink-0"
            >
              {scheduleAllMutation.isPending ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <CalendarCheck className="size-4 mr-1.5" />
              )}
              Schedule All ({uploadedPosts.length})
            </Button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Total Posts', value: allPosts.length, color: 'text-zinc-600', bg: 'bg-zinc-100 dark:bg-zinc-800' },
            { label: 'Scheduled', value: scheduledPosts.length, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Uploaded', value: uploadedPosts.length, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
            { label: 'Failed', value: failedPosts.length, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', hide: failedPosts.length === 0 },
          ].filter((s) => !s.hide).map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl px-3 py-2.5 ${bg}`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Platform + Logs tabs */}
      <Tabs defaultValue="instagram_carousel">
        <TabsList className="mb-4 h-auto flex-wrap gap-1 bg-transparent p-0">
          {PLATFORMS.map((p) => {
            const count = postsByPlatform[p.id]?.length ?? 0;
            return (
              <TabsTrigger
                key={p.id}
                value={p.id}
                className={`gap-1.5 h-8 text-xs border data-[state=active]:shadow-none ${p.tabBg}`}
              >
                <p.Icon className={`size-3.5 ${p.color}`} />
                {p.label}
                {count > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-4.5 text-xs bg-background/80 border rounded-full px-1.5 flex items-center justify-center">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="logs" className="gap-1.5 h-8 text-xs border data-[state=active]:shadow-none">
            <Activity className="size-3.5" />
            Pipeline Logs
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
                <div className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed rounded-xl">
                  <div className={`size-10 rounded-xl ${platform.bg} flex items-center justify-center`}>
                    <platform.Icon className={`size-5 ${platform.color}`} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No {platform.label} posts in this campaign.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onUpdate={(postId, data) => updateMutation.mutate({ postId, data })}
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="size-4" />
                  Pipeline Run Log
                </CardTitle>
                {ACTIVE_STATUSES.has(campaign.status) ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{allPosts.length > 0 ? 'Pipeline complete' : 'No logs'}</span>
                )}
              </div>
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
