'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider, SliderThumb } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  ChevronDown,
  ClapperboardIcon,
  TrendingUp,
  XCircle,
  CheckCircle2,
  Music,
  VolumeX,
  Volume2,
  Captions,
  Clock,
  DollarSign,
  Sparkles,
  Film,
  Settings2,
  Save,
} from 'lucide-react';

const TARGET_PLATFORMS = ['auto', 'instagram_reels', 'tiktok', 'youtube_shorts', 'linkedin'];
const VIDEO_STYLES = ['auto', 'explainer', 'diy', 'listicle', 'testimonial'];
const ORIENTATIONS = ['9:16', '16:9', '1:1', '4:5', '3:4', '21:9'];

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

const SEGMENT_STATUS_BADGE = {
  pending: 'secondary',
  generating: 'default',
  completed: 'default',
  failed: 'destructive',
};

function formatMs(ms) {
  if (!ms) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatCost(cost) {
  if (cost === null || cost === undefined) return '—';
  return `$${cost.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Video Configuration — per-post overrides of platform/style/shot count/
// orientation (inherits the campaign's default, which itself inherits the
// global Video Settings default, if left unset here). Only meaningful before
// a plan is drafted/approved — these feed directly into the director agent's
// Phase 1 brief.
// ---------------------------------------------------------------------------
function VideoConfigCard({ post, invalidate }) {
  const effective = post.effectiveConfig || {};
  const [targetPlatform, setTargetPlatform] = useState(post.targetPlatform ?? '');
  const [videoStyle, setVideoStyle] = useState(post.videoStyle ?? '');
  const [targetShotCount, setTargetShotCount] = useState(post.targetShotCount ?? '');
  const [orientation, setOrientation] = useState(post.orientation ?? '');

  useEffect(() => {
    setTargetPlatform(post.targetPlatform ?? '');
    setVideoStyle(post.videoStyle ?? '');
    setTargetShotCount(post.targetShotCount ?? '');
    setOrientation(post.orientation ?? '');
  }, [post.targetPlatform, post.videoStyle, post.targetShotCount, post.orientation]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPlatform: targetPlatform || null,
          videoStyle: videoStyle || null,
          targetShotCount: targetShotCount === '' ? null : Number(targetShotCount),
          orientation: orientation || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save config override');
    },
    onSuccess: () => { toast.success('Config saved — re-plan to apply it'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" />
          Video Configuration
        </CardTitle>
        <CardDescription className="text-xs">
          Overrides for this post only — leave a field on &quot;inherit&quot; to use the campaign/global default.
          Changing these only affects the NEXT plan draft (re-plan), not an already-approved plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Target platform <span className="opacity-60">(effective: {effective.platform})</span></Label>
          <Select value={targetPlatform || '__inherit'} onValueChange={(v) => setTargetPlatform(v === '__inherit' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__inherit">Inherit</SelectItem>
              {TARGET_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Video style <span className="opacity-60">(effective: {effective.style})</span></Label>
          <Select value={videoStyle || '__inherit'} onValueChange={(v) => setVideoStyle(v === '__inherit' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__inherit">Inherit</SelectItem>
              {VIDEO_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Shot count <span className="opacity-60">(effective: {effective.shotCount ?? 'auto'})</span></Label>
          <Input
            type="number" min={1} max={12} placeholder="inherit / auto"
            value={targetShotCount}
            onChange={(e) => setTargetShotCount(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Orientation <span className="opacity-60">(effective: {effective.orientation})</span></Label>
          <Select value={orientation || '__inherit'} onValueChange={(v) => setOrientation(v === '__inherit' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__inherit">Inherit</SelectItem>
              {ORIENTATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="col-span-2" variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
          Save config
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Phase 1 -> 2: Plan review/approval screen — shown whenever the post has a
// draft plan and hasn't been approved yet (or the plan failed and needs
// another draft). Narration + segment breakdown are editable before approval.
// ---------------------------------------------------------------------------
function PlanReviewCard({ post, invalidate }) {
  const [narration, setNarration] = useState(post.plan?.narration || post.narration || '');
  const [segments, setSegments] = useState(post.plan?.segments || []);
  const [note, setNote] = useState(post.directorNote || '');

  useEffect(() => {
    setNarration(post.plan?.narration || post.narration || '');
    setSegments(post.plan?.segments || []);
  }, [post.plan]);

  const rePlanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directorNote: note || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Re-planning failed');
      }
      return res.json();
    },
    onSuccess: () => { toast.success('Plan re-drafted'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/approve-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: { ...post.plan, narration, segments },
          directorNote: note || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Approval failed');
      }
      return res.json();
    },
    onSuccess: () => { toast.success('Plan approved — generating segments now'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function updateSegment(index, field, value) {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  const isPlanning = post.status === 'planning';
  const isApproving = post.status === 'approved' || post.status === 'directing';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm">Plan Review (Phase 1 → 2)</CardTitle>
          <Badge variant="secondary" className="ml-auto">no generation spend yet</Badge>
        </div>
        <CardDescription className="text-xs">
          Review and edit the narration and segment breakdown before any Higgsfield generation happens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPlanning ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Drafting plan…
          </div>
        ) : !post.plan ? (
          <p className="text-sm text-muted-foreground text-center py-6">No plan yet.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full continuous narration</Label>
              <Textarea value={narration} onChange={(e) => setNarration(e.target.value)} rows={4} className="text-sm" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Segments ({segments.length})</Label>
              {segments.map((seg, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">Segment {seg.order ?? i + 1}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">On camera</Label>
                      <Switch checked={!!seg.hasCharacter} onCheckedChange={(v) => updateSegment(i, 'hasCharacter', v)} />
                      {seg.estimatedDuration && <Badge variant="secondary" className="text-xs">~{seg.estimatedDuration}s</Badge>}
                    </div>
                  </div>
                  <Textarea
                    value={seg.spokenPortion || ''}
                    onChange={(e) => updateSegment(i, 'spokenPortion', e.target.value)}
                    placeholder="Spoken portion…"
                    rows={2}
                    className="text-xs"
                  />
                  <Textarea
                    value={seg.visualDescription || ''}
                    onChange={(e) => updateSegment(i, 'visualDescription', e.target.value)}
                    placeholder="Visual description…"
                    rows={2}
                    className="text-xs"
                  />
                </div>
              ))}
            </div>

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Director note for the next re-plan or approval (optional)…"
              rows={2}
              className="text-xs"
            />

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => rePlanMutation.mutate()} disabled={rePlanMutation.isPending || isApproving}>
                {rePlanMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <RefreshCw className="size-3.5 mr-1" />}
                Re-plan
              </Button>
              <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || isApproving}>
                {approveMutation.isPending || isApproving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="size-3.5 mr-1" />}
                {isApproving ? 'Generating…' : 'Approve & Generate'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SegmentBlock — one block in the timeline strip
// ---------------------------------------------------------------------------
function SegmentBlock({ segment, postId, invalidate }) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/segments/${segment.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Regeneration failed');
      }
      return res.json();
    },
    onSuccess: () => { toast.success(`Segment ${segment.order} regenerated`); setShowNote(false); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const generationMs = segment.generationStartedAt && segment.generationCompletedAt
    ? new Date(segment.generationCompletedAt) - new Date(segment.generationStartedAt)
    : null;

  return (
    <div className="border rounded-lg overflow-hidden shrink-0 w-56 flex flex-col">
      <div className="bg-black aspect-[9/16] flex items-center justify-center relative">
        {segment.videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={segment.videoUrl} controls className="w-full h-full object-contain" />
        ) : segment.status === 'generating' ? (
          <Loader2 className="size-6 text-white/60 animate-spin" />
        ) : (
          <ClapperboardIcon className="size-6 text-white/30" />
        )}
        <Badge variant={SEGMENT_STATUS_BADGE[segment.status] ?? 'secondary'} className="absolute top-1.5 left-1.5 text-[10px]">
          {segment.status}
        </Badge>
        {segment.hasCharacter && (
          <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[10px]">on camera</Badge>
        )}
      </div>
      <div className="p-2 space-y-1.5 flex-1 flex flex-col">
        <p className="text-[11px] font-mono text-muted-foreground">#{segment.order} · {segment.duration ? `${segment.duration.toFixed?.(1) ?? segment.duration}s` : '—'}</p>
        <p className="text-xs italic line-clamp-3 flex-1">&ldquo;{segment.spokenPortion || '—'}&rdquo;</p>
        {segment.errorMessage && <p className="text-[10px] text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-1 line-clamp-2">{segment.errorMessage}</p>}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5" title="Rate-card estimate — Higgsfield exposes no real cost API">
            <Clock className="size-2.5" />{formatMs(generationMs)}
          </span>
          <span className="flex items-center gap-0.5" title="Rate-card estimate — Higgsfield exposes no real cost API">
            <DollarSign className="size-2.5" />{formatCost(segment.estimatedCost)} est.
          </span>
        </div>
        {showNote && (
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for regeneration…" rows={2} className="text-[11px]" />
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs"
          onClick={() => (showNote ? regenerateMutation.mutate() : setShowNote(true))}
          disabled={regenerateMutation.isPending || segment.status === 'generating'}
        >
          {regenerateMutation.isPending ? <Loader2 className="size-3 mr-1 animate-spin" /> : <RefreshCw className="size-3 mr-1" />}
          {showNote ? 'Confirm regenerate' : 'Regenerate'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentTimeline — segment strip + music lane + re-assemble
// ---------------------------------------------------------------------------
function SegmentTimeline({ post, invalidate }) {
  const [musicVolume, setMusicVolume] = useState([post.musicVolume ?? 0.3]);
  const [preMuteVolume, setPreMuteVolume] = useState(post.musicVolume || 0.3);
  const [captionsEnabled, setCaptionsEnabled] = useState(post.captionsEnabled ?? true);

  useEffect(() => {
    setMusicVolume([post.musicVolume ?? 0.3]);
    if (post.musicVolume) setPreMuteVolume(post.musicVolume);
    setCaptionsEnabled(post.captionsEnabled ?? true);
  }, [post.musicVolume, post.captionsEnabled]);

  const saveMusicMutation = useMutation({
    mutationFn: async (volume) => {
      const res = await apiFetch(`/api/video/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicVolume: volume }),
      });
      if (!res.ok) throw new Error('Failed to save music volume');
    },
    onError: (e) => toast.error(e.message),
  });

  const saveCaptionsMutation = useMutation({
    mutationFn: async (enabled) => {
      const res = await apiFetch(`/api/video/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captionsEnabled: enabled }),
      });
      if (!res.ok) throw new Error('Failed to save captions setting');
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const reassembleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/reassemble`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Re-assembly failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      const skipReason = data?.result?.captionsSkipReason;
      if (skipReason) {
        toast.success(`Video assembled (captions skipped: ${skipReason})`);
      } else {
        toast.success('Video assembled');
      }
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const segments = post.segments || [];
  const completedCount = segments.filter((s) => s.status === 'completed').length;
  const canAssemble = completedCount > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">Segment Timeline</CardTitle>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-3" />{formatMs(post.totalGenerationTimeMs)}</span>
            <span className="flex items-center gap-1" title="Includes rate-card Higgsfield estimates — exact for music/captions">
              <DollarSign className="size-3" />~{formatCost(post.totalEstimatedCost)}
            </span>
          </div>
        </div>
        <CardDescription className="text-xs">
          {completedCount}/{segments.length} segments generated. Regenerate any segment individually, then re-assemble when ready — assembly never runs automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {segments.map((segment) => (
            <SegmentBlock key={segment.id} segment={segment} postId={post.id} invalidate={invalidate} />
          ))}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Music className="size-3.5" /> Music lane
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => {
                if (musicVolume[0] > 0) {
                  setPreMuteVolume(musicVolume[0]);
                  setMusicVolume([0]);
                  saveMusicMutation.mutate(0);
                } else {
                  const restored = preMuteVolume || 0.3;
                  setMusicVolume([restored]);
                  saveMusicMutation.mutate(restored);
                }
              }}
              title={musicVolume[0] === 0 ? 'Unmute' : 'Mute'}
            >
              {musicVolume[0] === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <Slider
              value={musicVolume}
              onValueChange={setMusicVolume}
              onValueCommit={(v) => saveMusicMutation.mutate(v[0])}
              min={0} max={1} step={0.05}
              className="flex-1"
            >
              <SliderThumb />
            </Slider>
            <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(musicVolume[0] * 100)}%</span>
          </div>
          {post.musicUrl && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio src={post.musicUrl} controls className="w-full h-8" />
          )}

          <div className="flex items-center justify-between pt-1">
            <Label className="text-xs flex items-center gap-1.5"><Captions className="size-3.5" /> Captions (9:16 only)</Label>
            <Switch
              checked={captionsEnabled}
              onCheckedChange={(v) => { setCaptionsEnabled(v); saveCaptionsMutation.mutate(v); }}
            />
          </div>
        </div>

        <Button className="w-full" onClick={() => reassembleMutation.mutate()} disabled={!canAssemble || reassembleMutation.isPending}>
          {reassembleMutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Sparkles className="size-4 mr-1.5" />}
          Re-assemble
        </Button>

        {post.videoUrl && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">Assembled video</Label>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={post.videoUrl} controls className="w-full max-w-xs mx-auto rounded-lg bg-black" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function VideoPostDetailPage() {
  const { postId } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showLog, setShowLog] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ['video-post', postId],
    queryFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}`);
      if (!res.ok) throw new Error('Failed to load post');
      const j = await res.json();
      return j.data;
    },
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'planning' || s === 'directing' || s === 'approved' ? 4000 : 8000;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['video-post', postId] });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/export`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start export');
    },
    onSuccess: () => { toast.success('Export started'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/schedule`, { method: 'POST' });
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
      const res = await apiFetch(`/api/video/posts/${postId}/unschedule`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to unschedule');
    },
    onSuccess: () => { toast.success('Removed from Buffer'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const analyticsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/analytics`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pull analytics');
      return res.json();
    },
    onSuccess: () => { toast.success('Analytics updated'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <Container>
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      </Container>
    );
  }

  if (!post) {
    return <Container><p className="text-sm text-muted-foreground py-12 text-center">Post not found.</p></Container>;
  }

  const showPlanReview = ['pending', 'planning', 'plan_ready', 'approved'].includes(post.status) && (post.plan || post.status === 'planning');
  const showTimeline = (post.segments || []).length > 0;

  return (
    <Container>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/video/${post.campaignId}`)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{post.article?.title || 'Untitled article'}</h1>
          <p className="text-sm text-muted-foreground">
            {post.duration ? `${post.duration}s` : '—'} · {post.aspectRatio || post.orientation || '—'} · {post.genre || '—'}
          </p>
        </div>
        <Badge variant={STATUS_BADGE[post.status] ?? 'secondary'}>{post.status.replace(/_/g, ' ')}</Badge>
      </div>

      {post.errorMessage && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-3 mb-4">{post.errorMessage}</p>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {showPlanReview && <VideoConfigCard post={post} invalidate={invalidate} />}
        {showPlanReview && <PlanReviewCard post={post} invalidate={invalidate} />}
        {showTimeline && <SegmentTimeline post={post} invalidate={invalidate} />}

        <Card className={showPlanReview || showTimeline ? '' : 'lg:col-span-2'}>
          <CardHeader>
            <CardTitle className="text-sm">Caption & Publishing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={post.generatedText || ''} readOnly rows={3} className="text-xs" placeholder="Caption will appear here once planned" />
            {post.hashtags?.length > 0 && <p className="text-xs text-muted-foreground">{post.hashtags.join(' ')}</p>}

            <div className="flex flex-wrap gap-1.5">
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
                  <ChevronDown className={`size-3.5 transition-transform ${showLog ? 'rotate-180' : ''}`} />
                  Session: {post.directorSessionId ? post.directorSessionId.slice(0, 12) + '…' : 'not started'}
                </button>
              </CollapsibleTrigger>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
