'use client';

import { useState, use, useEffect, useRef, useMemo, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  ChevronLeft,
  X as XIcon,
  ImageIcon,
  Eye,
  Pencil,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
  Heart,
  MousePointerClick,
  Trash2,
  BrainCircuit,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
// Calendar helpers
// ---------------------------------------------------------------------------
const DAY_START_H = 6;
const DAY_END_H = 22;
const TIME_LABELS = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

function topPercent(scheduledAt) {
  if (!scheduledAt) return 10;
  const d = new Date(scheduledAt);
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.max(2, Math.min(94, ((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100));
}

const PLATFORM_BORDER_COLOR = {
  instagram_carousel: '#ec4899',
  instagram_story: '#a855f7',
  linkedin: '#2563eb',
  twitter: '#71717a',
};

function StatusDot({ status }) {
  if (['pending', 'content_generating', 'exporting', 'scheduling'].includes(status)) {
    return <span className="size-2 rounded-full border-2 border-amber-400 bg-transparent shrink-0" />;
  }
  if (['content_ready', 'uploaded'].includes(status)) {
    return <span className="size-2 rounded-full bg-yellow-400 shrink-0" />;
  }
  if (['scheduled', 'done'].includes(status)) {
    return <span className="size-2 rounded-full bg-emerald-500 shrink-0" />;
  }
  if (status === 'failed') {
    return <span className="size-2 rounded-full bg-red-500 shrink-0" />;
  }
  return <span className="size-2 rounded-full bg-zinc-400 shrink-0" />;
}

function PostChip({ post, onClick }) {
  const platform = PLATFORMS.find((p) => p.id === post.platform);
  const Icon = platform?.Icon ?? Share2;
  const borderColor = PLATFORM_BORDER_COLOR[post.platform] ?? '#71717a';
  const timeLabel = post.scheduledAt ? format(new Date(post.scheduledAt), 'HH:mm') : '—';
  const sectionName = post.article?.section?.name;
  const colorAccent = post.article?.section?.colorAccent;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${platform?.label ?? post.platform} post: ${post.article?.title ?? 'Post'} at ${timeLabel}`}
      className="w-full text-left bg-card/90 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer rounded-md overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="px-2 py-1.5 space-y-0.5">
        <div className="flex items-center gap-1">
          <Icon className={`size-3 ${platform?.color ?? 'text-zinc-500'} shrink-0`} />
          <span className="text-[10px] text-muted-foreground tabular-nums flex-1">{timeLabel}</span>
          <StatusDot status={post.status} />
        </div>
        <p className="text-xs font-medium line-clamp-2 leading-tight">
          {post.article?.title ?? 'Untitled'}
        </p>
        {sectionName && (
          <span
            className="inline-block text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: colorAccent ? colorAccent + '22' : 'rgba(0,0,0,0.08)',
              color: colorAccent ?? '#666',
            }}
          >
            {sectionName}
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CarouselViewer — Embla slider for instagram_carousel posts
// ---------------------------------------------------------------------------
function CarouselViewer({ urls }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrent(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    return () => emblaApi.off('select', onSelect);
  }, [emblaApi, onSelect]);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg" ref={emblaRef}>
        <div className="flex">
          {urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`Slide ${i + 1}`}
              className="flex-[0_0_100%] w-full object-cover rounded-lg"
              style={{ aspectRatio: '4/5' }}
            />
          ))}
        </div>
        {/* Prev / Next */}
        {urls.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={current === 0}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 disabled:opacity-30 transition-opacity"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              disabled={current === urls.length - 1}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 disabled:opacity-30 transition-opacity"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
        {/* Counter badge */}
        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full">
          {current + 1}/{urls.length}
        </span>
      </div>
      {/* Dot indicators */}
      {urls.length > 1 && (
        <div className="flex justify-center gap-1">
          {urls.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              className={`size-1.5 rounded-full transition-colors ${i === current ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LightboxViewer — click to open full-size for story / linkedin posts
// ---------------------------------------------------------------------------
function LightboxViewer({ urls }) {
  const [open, setOpen] = useState(null); // index of open image

  return (
    <>
      <div className="flex gap-1.5 flex-wrap">
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={url}
            alt={`Image ${i + 1}`}
            onClick={() => setOpen(i)}
            className="h-24 w-auto object-cover rounded-lg border cursor-zoom-in hover:opacity-90 transition-opacity"
          />
        ))}
      </div>

      {/* Lightbox overlay */}
      {open !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[open]}
            alt={`Image ${open + 1}`}
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
          >
            <XIcon className="size-5" />
          </button>
          {urls.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
              {open + 1} / {urls.length}
            </span>
          )}
        </div>
      )}
    </>
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

        {/* Image viewer — slider for carousel, lightbox for others */}
        {post.imageUrls?.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="size-3" />
              <span>{post.imageUrls.length} {post.platform === 'instagram_carousel' ? 'slide' : 'image'}{post.imageUrls.length > 1 ? 's' : ''}</span>
            </div>
            {post.platform === 'instagram_carousel' ? (
              <CarouselViewer urls={post.imageUrls} />
            ) : (
              <LightboxViewer urls={post.imageUrls} />
            )}
          </div>
        )}

        {/* Caption */}
        {(post.platform !== 'twitter' && post.platform !== 'instagram_story') && (
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
          {(post.status === 'content_ready' || post.status === 'failed' || post.status === 'exporting' || post.status === 'uploaded') && (
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/social/campaigns/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete campaign');
    },
    onSuccess: () => {
      toast.success('Campaign deleted');
      router.push('/dashboard/social');
    },
    onError: (e) => toast.error(e.message),
  });

  const clearSessionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/social/campaigns/${id}/clear-sessions`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to clear sessions');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message ?? 'Sessions cleared');
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

  const [selectedPost, setSelectedPost] = useState(null);

  const weekDays = useMemo(() => {
    const days = [];
    const start = new Date(campaign.weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [campaign.weekStart]);

  const postsByDay = useMemo(() => {
    const map = {};
    for (const post of campaign.posts ?? []) {
      if (!post.scheduledAt) continue;
      const dayKey = new Date(post.scheduledAt).toDateString();
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(post);
    }
    return map;
  }, [campaign.posts]);

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

          <div className="flex items-center gap-2 shrink-0">
            {/* Clear article AI sessions */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={clearSessionsMutation.isPending}
                >
                  {clearSessionsMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <BrainCircuit className="size-3.5" />
                  )}
                  Clear Sessions
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear article AI sessions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the Anthropic session ID from all articles in this campaign. The content agent will start a fresh session next time content is generated or regenerated — it will lose memory of previous edits for these articles.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearSessionsMutation.mutate()}>
                    Clear Sessions
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Schedule all */}
            {canScheduleAll && (
              <Button
                onClick={() => scheduleAllMutation.mutate()}
                disabled={scheduleAllMutation.isPending}
                size="sm"
                className="h-8 text-xs"
              >
                {scheduleAllMutation.isPending ? (
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                ) : (
                  <CalendarCheck className="size-3.5 mr-1" />
                )}
                Schedule All ({uploadedPosts.length})
              </Button>
            )}

            {/* Delete campaign */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the campaign and all its posts and pipeline logs. Exported images in storage will not be removed. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteMutation.mutate()}
                  >
                    Delete Campaign
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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

      {/* Week Calendar */}
      <div className="overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex" style={{ minWidth: `calc(3rem + 7 * 160px)` }}>
          {/* Time axis */}
          <div className="relative w-12 shrink-0" style={{ minHeight: 560 }}>
            {TIME_LABELS.map((label) => {
              const h = parseInt(label.split(':')[0], 10);
              const top = ((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100;
              return (
                <span
                  key={label}
                  className="absolute right-1 text-[10px] text-muted-foreground tabular-nums -translate-y-1/2 select-none"
                  style={{ top: `${top}%` }}
                >
                  {label}
                </span>
              );
            })}
          </div>

          {/* Day columns */}
          <div className="flex flex-1 gap-px">
            {weekDays.map((day) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const dayKey = day.toDateString();
              const dayPosts = (postsByDay[dayKey] ?? []).slice().sort(
                (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt),
              );

              // Group by 30-min window to compute stacking offsets
              const windowGroups = {};
              for (const post of dayPosts) {
                const d = new Date(post.scheduledAt);
                const wk = `${d.getHours()}:${d.getMinutes() < 30 ? '00' : '30'}`;
                if (!windowGroups[wk]) windowGroups[wk] = [];
                windowGroups[wk].push(post);
              }
              const postsWithOffset = [];
              for (const posts of Object.values(windowGroups)) {
                posts.forEach((post, idx) => postsWithOffset.push({ post, idx }));
              }

              return (
                <div key={dayKey} className="flex-1 min-w-[160px] flex flex-col">
                  {/* Day header */}
                  <div
                    className={`text-center py-2 border-b mb-1 rounded-t-lg border ${
                      isToday ? 'ring-2 ring-primary' : 'border-border'
                    }`}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {format(day, 'EEE')}
                    </p>
                    <p className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{format(day, 'MMM')}</p>
                  </div>

                  {/* Post chip area */}
                  <div
                    className="relative flex-1 border border-border rounded-b-lg bg-muted/20"
                    style={{ minHeight: 560 }}
                  >
                    {/* Hour grid lines */}
                    {TIME_LABELS.map((label) => {
                      const h = parseInt(label.split(':')[0], 10);
                      const top = ((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100;
                      return (
                        <div
                          key={label}
                          className="absolute left-0 right-0 border-t border-border/30"
                          style={{ top: `${top}%` }}
                        />
                      );
                    })}

                    {/* Post chips */}
                    {postsWithOffset.map(({ post, idx }) => (
                      <div
                        key={post.id}
                        className="absolute left-1 right-1"
                        style={{ top: `calc(${topPercent(post.scheduledAt)}% + ${idx * 2}%)` }}
                      >
                        <PostChip post={post} onClick={() => setSelectedPost(post)} />
                      </div>
                    ))}

                    {dayPosts.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-[10px] text-muted-foreground/40 select-none">No posts</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pipeline Logs */}
      <details defaultOpen={ACTIVE_STATUSES.has(campaign.status)} className="mt-6">
        <summary className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none py-2">
          <Activity className="size-4" />
          Pipeline Logs
          {ACTIVE_STATUSES.has(campaign.status) && (
            <span className="size-2 rounded-full bg-blue-500 animate-pulse ml-1" />
          )}
        </summary>
        <Card className="mt-3">
          <CardContent className="max-h-[500px] overflow-y-auto pt-4">
            <PipelineLogs campaignId={id} campaignStatus={campaign.status} />
          </CardContent>
        </Card>
      </details>

      {/* Post detail sheet */}
      <Sheet open={!!selectedPost} onOpenChange={(open) => { if (!open) setSelectedPost(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedPost && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-center gap-2">
                  {(() => {
                    const platform = PLATFORMS.find((p) => p.id === selectedPost.platform);
                    const Icon = platform?.Icon ?? Share2;
                    return <Icon className={`size-4 ${platform?.color ?? 'text-zinc-500'}`} />;
                  })()}
                  <SheetTitle className="text-sm leading-tight line-clamp-2 text-left">
                    {selectedPost.article?.title ?? 'Post'}
                  </SheetTitle>
                </div>
                {selectedPost.scheduledAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(selectedPost.scheduledAt), 'EEEE, MMM d · h:mm a')}
                  </p>
                )}
              </SheetHeader>
              <PostCard
                post={selectedPost}
                onUpdate={(postId, data) => updateMutation.mutate({ postId, data })}
                onRegenerate={(postId, instruction) =>
                  regenerateMutation.mutate({ postId, instruction })
                }
                onExport={(postId) => exportMutation.mutate(postId)}
                onPullAnalytics={(postId) => analyticsMutation.mutate(postId)}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </Container>
  );
}
