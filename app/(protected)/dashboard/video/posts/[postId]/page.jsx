'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardHeading, CardTitle, CardDescription, CardToolbar } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
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
import { VIDEO_PLATFORM_OPTIONS } from '@/lib/video-platforms';
import { estimateStillCost } from '@/lib/video-cost';
import { postToast } from '@/lib/video-toast';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Upload,
  CalendarClock,
  ChevronDown,
  ChevronUp,
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
  AlertCircle,
  Hash,
  Plus,
  Trash2,
  Link as LinkIcon,
  History,
  RotateCcw,
  PlayCircle,
} from 'lucide-react';

function toLocalDatetimeInputValue(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TARGET_PLATFORMS = ['auto', 'instagram_reels', 'tiktok', 'youtube_shorts', 'linkedin'];
const VIDEO_STYLES = ['auto', 'explainer', 'diy', 'listicle', 'testimonial'];
const ORIENTATIONS = ['9:16', '16:9', '1:1', '4:5', '3:4', '21:9'];

const STATUS_BADGE = {
  pending: { variant: 'secondary', appearance: 'light' },
  planning: { variant: 'info', appearance: 'light' },
  plan_ready: { variant: 'info', appearance: 'light' },
  approved: { variant: 'info', appearance: 'light' },
  shooting_stills: { variant: 'info', appearance: 'light' },
  stills_review: { variant: 'warning', appearance: 'light' },
  directing: { variant: 'info', appearance: 'light' },
  content_ready: { variant: 'success', appearance: 'light' },
  exporting: { variant: 'info', appearance: 'light' },
  uploaded: { variant: 'success', appearance: 'light' },
  scheduling: { variant: 'warning', appearance: 'light' },
  scheduled: { variant: 'success', appearance: 'light' },
  failed: { variant: 'destructive', appearance: 'light' },
};

const SEGMENT_STATUS_BADGE = {
  pending: { variant: 'secondary', appearance: 'light' },
  generating: { variant: 'info', appearance: 'light' },
  completed: { variant: 'success', appearance: 'light' },
  failed: { variant: 'destructive', appearance: 'light' },
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
  const notify = postToast(post);
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
    onSuccess: () => { notify.success('Config saved — re-plan to apply it'); invalidate(); },
    onError: (e) => notify.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            Video Configuration
          </CardTitle>
          <CardDescription className="text-xs">
            Overrides for this post only — leave a field on &quot;inherit&quot; to use the campaign/global default.
          </CardDescription>
        </CardHeading>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground -mt-1">
          Changing these only affects the <span className="font-medium text-foreground">next</span> plan draft (re-plan), not an already-approved plan.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Target platform <span className="opacity-60">(eff: {effective.platform})</span></Label>
            <Select value={targetPlatform || '__inherit'} onValueChange={(v) => setTargetPlatform(v === '__inherit' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__inherit">Inherit</SelectItem>
                {TARGET_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Video style <span className="opacity-60">(eff: {effective.style})</span></Label>
            <Select value={videoStyle || '__inherit'} onValueChange={(v) => setVideoStyle(v === '__inherit' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__inherit">Inherit</SelectItem>
                {VIDEO_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Shot count <span className="opacity-60">(eff: {effective.shotCount ?? 'auto'})</span></Label>
            <Input
              type="number" min={1} max={12} placeholder="inherit / auto"
              value={targetShotCount}
              onChange={(e) => setTargetShotCount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Orientation <span className="opacity-60">(eff: {effective.orientation})</span></Label>
            <Select value={orientation || '__inherit'} onValueChange={(v) => setOrientation(v === '__inherit' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__inherit">Inherit</SelectItem>
                {ORIENTATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save config
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Phase 1 -> 2: Plan review/approval screen. Never hidden once a plan
// exists (even after execution) — shows EVERYTHING the Planner Agent
// decided: narration, character look, segment breakdown, genre, caption,
// and hashtags. Re-plan is a targeted edit by default (only what the note
// asks for changes) unless the note explicitly asks for a full rewrite.
// ---------------------------------------------------------------------------
function PlanReviewCard({ post, invalidate, alreadyExecuted }) {
  const notify = postToast(post);
  const [narration, setNarration] = useState(post.plan?.narration || post.narration || '');
  const [characterLook, setCharacterLook] = useState(post.plan?.characterLook || '');
  const [subjectAnchor, setSubjectAnchor] = useState(post.plan?.subjectAnchor || '');
  const [segments, setSegments] = useState(post.plan?.segments || []);
  const [genre, setGenre] = useState(post.plan?.genre || '');
  const [captionText, setCaptionText] = useState(post.plan?.text || '');
  const [hashtagsText, setHashtagsText] = useState((post.plan?.hashtags || []).join(' '));
  const [note, setNote] = useState(post.directorNote || '');

  useEffect(() => {
    setNarration(post.plan?.narration || post.narration || '');
    setCharacterLook(post.plan?.characterLook || '');
    setSubjectAnchor(post.plan?.subjectAnchor || '');
    setSegments(post.plan?.segments || []);
    setGenre(post.plan?.genre || '');
    setCaptionText(post.plan?.text || '');
    setHashtagsText((post.plan?.hashtags || []).join(' '));
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
    onSuccess: () => { notify.success('Plan revised — targeted edit applied (full rewrite only if your note asked for one)'); invalidate(); },
    onError: (e) => notify.error(`Re-plan failed: ${e.message}`),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const hashtags = hashtagsText.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      const res = await apiFetch(`/api/video/posts/${post.id}/approve-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: {
            ...post.plan,
            narration,
            characterLook,
            subjectAnchor: subjectAnchor.trim() || null,
            segments,
            genre,
            text: captionText,
            hashtags,
          },
          directorNote: note || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Could not generate the start frames');
      }
      return res.json();
    },
    onSuccess: () => { notify.success('Plan approved — generating start frames for your review, you can leave this page'); invalidate(); },
    onError: (e) => notify.error(`Could not generate the start frames: ${e.message}`),
  });

  function handleApproveClick() {
    if (alreadyExecuted) {
      const ok = window.confirm(
        'This post already has generated segments. Approving this plan starts over from fresh start frames, and shooting them again later will regenerate every existing segment from scratch (real Higgsfield spend). Continue?',
      );
      if (!ok) return;
    }
    approveMutation.mutate();
  }

  function updateSegment(index, field, value) {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function renumber(list) {
    return list.map((s, i) => ({ ...s, order: i + 1 }));
  }

  function addSegment() {
    setSegments((prev) => renumber([
      ...prev,
      { hasCharacter: false, spokenPortion: '', visualDescription: '', estimatedDuration: 6, stillReferenceOrder: null },
    ]));
  }

  function removeSegment(index) {
    setSegments((prev) => (prev.length <= 1 ? prev : renumber(prev.filter((_, i) => i !== index))));
  }

  function moveSegment(index, direction) {
    setSegments((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return renumber(next);
    });
  }

  const isPlanning = post.status === 'planning';
  // "directing" is a resting state as much as an active one — a post stays
  // there after execution finishes, until someone assembles it. So being busy
  // is derived from the segments actually in flight (or still missing versus
  // the plan) rather than from the status alone, otherwise Re-plan and
  // Approve stay disabled forever once a shoot completes.
  const liveSegments = post.segments || [];
  const isExecuting =
    post.status === 'approved' ||
    post.status === 'shooting_stills' ||
    (post.status === 'directing' &&
      (liveSegments.some((s) => s.status === 'generating' || s.status === 'pending') ||
        liveSegments.length < (post.plan?.segments?.length || 0)));

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            Plan Review
          </CardTitle>
          <CardDescription className="text-xs">
            Everything the Planner Agent decided — review and edit before (or after) generation.
          </CardDescription>
        </CardHeading>
        <CardToolbar>
          <Badge variant="secondary" appearance="light" size="sm">no spend yet</Badge>
        </CardToolbar>
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
            {alreadyExecuted && (
              <Alert variant="warning" appearance="light">
                <AlertIcon><AlertCircle className="size-4" /></AlertIcon>
                <AlertTitle className="text-xs">
                  Segments already exist for this post. Editing and re-approving the plan below will regenerate them from scratch.
                </AlertTitle>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full continuous narration</Label>
              <Textarea value={narration} onChange={(e) => setNarration(e.target.value)} rows={4} className="text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Character look (wardrobe/hair/styling for this shoot)</Label>
              <Textarea
                value={characterLook}
                onChange={(e) => setCharacterLook(e.target.value)}
                placeholder="e.g. cream cashmere sweater, hair down in soft waves, minimal jewelry…"
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Subject anchor (the one recurring thing this video is about)</Label>
              <Textarea
                value={subjectAnchor}
                onChange={(e) => setSubjectAnchor(e.target.value)}
                placeholder="e.g. a six-foot reach-in closet with warm walnut-fronted shelving, one brushed-brass rail, cream canvas bins…"
                rows={2}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Repeated verbatim in every frame that shows it. Without it each shot invents a different version of the subject.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Segments ({segments.length})</Label>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addSegment}>
                  <Plus className="size-3.5" /> Add segment
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {segments.map((seg, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-foreground">
                        {seg.order ?? i + 1}
                      </span>
                      Segment
                    </span>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs mr-1">On camera</Label>
                      <Switch checked={!!seg.hasCharacter} onCheckedChange={(v) => updateSegment(i, 'hasCharacter', v)} />
                      {seg.estimatedDuration && <Badge variant="secondary" appearance="light" size="sm">~{seg.estimatedDuration}s</Badge>}
                      <Button size="icon" variant="ghost" className="size-6" onClick={() => moveSegment(i, -1)} disabled={i === 0} title="Move up">
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-6" onClick={() => moveSegment(i, 1)} disabled={i === segments.length - 1} title="Move down">
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-6" onClick={() => removeSegment(i)} disabled={segments.length <= 1} title="Remove segment">
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
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
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] text-muted-foreground shrink-0">Match frame of segment</Label>
                    <Input
                      type="number"
                      min={1}
                      max={segments.length}
                      placeholder="—"
                      value={seg.stillReferenceOrder ?? ''}
                      onChange={(e) =>
                        updateSegment(i, 'stillReferenceOrder', e.target.value ? Number(e.target.value) : null)
                      }
                      className="h-7 w-16 text-xs"
                      title="For a before/after pair: reuse that segment's frame as an image reference so both shots show literally the same thing. Leave empty otherwise."
                    />
                  </div>
                </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Genre</Label>
                <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="epic" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Hashtags (space-separated)</Label>
                <Input value={hashtagsText} onChange={(e) => setHashtagsText(e.target.value)} placeholder="#tag1 #tag2" className="text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Caption</Label>
              <Textarea value={captionText} onChange={(e) => setCaptionText(e.target.value)} rows={2} className="text-sm" />
            </div>

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note for the next re-plan (targeted edit — e.g. &quot;make her clothes more casual&quot;) or approval…"
              rows={2}
              className="text-xs"
            />

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => rePlanMutation.mutate()} disabled={rePlanMutation.isPending || isExecuting}>
                {rePlanMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Re-plan
              </Button>
              <Button size="sm" onClick={handleApproveClick} disabled={approveMutation.isPending || isExecuting} className="flex-1">
                {approveMutation.isPending || isExecuting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                {isExecuting ? 'Generating…' : alreadyExecuted ? 'Re-approve & Redo Start Frames' : 'Approve & Generate Start Frames'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ShotText — a frame and its clip are judged on the same two facts: what the
// shot shows and what is said over it. Showing one without the other is how
// b-roll described as b-roll but flagged on-camera got through review.
// ---------------------------------------------------------------------------
function ShotText({ label, text, quoted = false }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        {label}
      </p>
      <p
        role="button"
        tabIndex={0}
        title="Click to show all"
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        onKeyDown={(e) => { if (e.key === 'Enter') setExpanded((v) => !v); }}
        className={`text-[11px] cursor-pointer ${quoted ? 'italic' : 'text-muted-foreground'} ${expanded ? '' : 'line-clamp-3'}`}
      >
        {quoted ? `\u201C${text}\u201D` : text}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StillTile — one reviewable start frame. Regenerating a frame is ~$0.40
// against ~$2.90 for the clip it would have produced, which is the whole
// reason this screen exists.
// ---------------------------------------------------------------------------
function StillTile({
  post,
  invalidate,
  label,
  caption,
  captionLabel = 'Shot',
  spoken,
  url,
  target,
  order,
  busy,
}) {
  const notify = postToast(post);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/stills/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, order, note: note || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to start regeneration');
      }
      return res.json();
    },
    onSuccess: () => {
      notify.success(`${label} is being redone — the new frame will appear here`);
      setShowNote(false);
      setNote('');
      invalidate();
    },
    onError: (e) => notify.error(`${label}: ${e.message}`),
  });

  return (
    <div className="border rounded-lg overflow-hidden bg-muted/20">
      <div className="aspect-[9/16] max-h-64 bg-black/80 flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-contain" />
        ) : busy ? (
          <Loader2 className="size-5 animate-spin text-white/60" />
        ) : (
          <span className="text-xs text-white/60 px-3 text-center">No frame yet</span>
        )}
      </div>
      <div className="p-2.5 space-y-2">
        <p className="text-xs font-medium">{label}</p>
        <ShotText label={captionLabel} text={caption} />
        <ShotText label="Narration" text={spoken} quoted />
        {showNote && (
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's wrong with it? e.g. an extra hand in the frame, the screw threads run backwards…"
            rows={2}
            className="text-xs"
          />
        )}
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1"
            onClick={() => (showNote ? regenerateMutation.mutate() : setShowNote(true))}
            disabled={regenerateMutation.isPending || busy}
          >
            {regenerateMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            {showNote ? 'Redo this frame' : 'Reject'}
          </Button>
          {showNote && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNote(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StillsReviewCard — the gate between cheap stills and expensive clips. A
// malformed frame (extra limb, hardware assembled backwards) reliably becomes
// a malformed clip, so nothing is shot until these are signed off.
// ---------------------------------------------------------------------------
function StillsReviewCard({ post, invalidate, alreadyExecuted }) {
  const notify = postToast(post);
  const segments = post.segments || [];
  const isGenerating = post.status === 'shooting_stills';
  const isShooting = post.status === 'directing' && segments.some((s) => s.status === 'generating');
  // An avatar segment with no frame of its own predates per-segment character
  // frames and falls back to the anchor, so it isn't "missing".
  const missingFrames =
    !post.anchorStillUrl || segments.some((s) => !s.stillUrl && !s.hasCharacter);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/approve-stills`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Could not start the shoot');
      }
      return res.json();
    },
    onSuccess: () => { notify.success('Frames approved — shooting now, you can leave this page'); invalidate(); },
    onError: (e) => notify.error(`Could not start the shoot: ${e.message}`),
  });

  function handleApproveClick() {
    if (alreadyExecuted) {
      const ok = window.confirm(
        'This post already has generated clips. Shooting again will regenerate every segment from scratch (real Higgsfield spend). Continue?',
      );
      if (!ok) return;
    }
    approveMutation.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle className="text-sm flex items-center gap-2">
            <Film className="size-4 text-muted-foreground" />
            Start Frames
          </CardTitle>
          <CardDescription className="text-xs">
            Check every frame before the clips are shot — a bad frame always becomes a bad clip, and the clip costs about seven times as much.
          </CardDescription>
        </CardHeading>
        <CardToolbar>
          <Badge variant="secondary" appearance="light" size="sm">
            ~{formatCost(estimateStillCost(segments.filter((s) => s.stillUrl).length + 1))} spent so far
          </Badge>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating && !post.anchorStillUrl ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Generating start frames…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StillTile
                post={post}
                invalidate={invalidate}
                label="Character anchor"
                captionLabel="About this frame"
                caption="The canonical look. Every on-camera frame is generated from this one, so redoing it means redoing those too."
                url={post.anchorStillUrl}
                target="anchor"
                order={null}
                busy={isGenerating}
              />
              {segments.map((seg) => (
                <StillTile
                  key={seg.id}
                  post={post}
                  invalidate={invalidate}
                  label={`Segment ${seg.order}${seg.hasCharacter ? ' · on camera' : ''}`}
                  caption={seg.visualDescription}
                  spoken={seg.spokenPortion}
                  url={seg.stillUrl}
                  target="segment"
                  order={seg.order}
                  busy={isGenerating}
                />
              ))}
            </div>

            {missingFrames && (
              <Alert variant="warning" appearance="light">
                <AlertIcon><AlertCircle className="size-4" /></AlertIcon>
                <AlertTitle className="text-xs">
                  Some frames are still missing — redo them before shooting.
                </AlertTitle>
              </Alert>
            )}

            <Button
              size="sm"
              className="w-full"
              onClick={handleApproveClick}
              disabled={approveMutation.isPending || isGenerating || isShooting || missingFrames}
            >
              {approveMutation.isPending || isShooting ? <Loader2 className="size-3.5 animate-spin" /> : <ClapperboardIcon className="size-3.5" />}
              {isShooting ? 'Shooting…' : `Approve frames & shoot ${segments.length} clip${segments.length === 1 ? '' : 's'}`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SegmentBlock — one block in the timeline strip
// ---------------------------------------------------------------------------
function SegmentBlock({ segment, post, invalidate }) {
  const postId = post.id;
  const notify = postToast(post);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlValue, setUrlValue] = useState(segment.videoUrl || '');
  const [durationValue, setDurationValue] = useState(segment.duration ?? '');
  const [showVersions, setShowVersions] = useState(false);
  const badgeCfg = SEGMENT_STATUS_BADGE[segment.status] ?? { variant: 'secondary', appearance: 'light' };
  const versions = segment.versions ?? [];

  const setUrlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/segments/${segment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: urlValue, duration: durationValue === '' ? null : durationValue }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to save URL');
      }
      return res.json();
    },
    onSuccess: () => { notify.success(`Segment ${segment.order} clip updated`); setShowUrlForm(false); invalidate(); },
    onError: (e) => notify.error(`Segment ${segment.order}: ${e.message}`),
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId) => {
      const res = await apiFetch(`/api/video/posts/${postId}/segments/${segment.id}/versions/${versionId}/restore`, {
        method: 'POST',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to restore version');
      }
      return res.json();
    },
    onSuccess: () => { notify.success(`Segment ${segment.order} restored — re-assemble to apply`); invalidate(); },
    onError: (e) => notify.error(`Segment ${segment.order}: ${e.message}`),
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/segments/${segment.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Could not start regeneration');
      }
      return res.json();
    },
    onSuccess: () => {
      notify.success(`Segment ${segment.order} regenerating — you can leave this page`);
      setShowNote(false);
      invalidate();
    },
    onError: (e) => notify.error(`Segment ${segment.order} could not start: ${e.message}`),
  });

  const generationMs = segment.generationStartedAt && segment.generationCompletedAt
    ? new Date(segment.generationCompletedAt) - new Date(segment.generationStartedAt)
    : null;

  return (
    <div className="border rounded-lg overflow-hidden shrink-0 w-56 flex flex-col bg-card">
      <div className="bg-black aspect-[9/16] flex items-center justify-center relative">
        {segment.videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={segment.videoUrl} controls className="w-full h-full object-contain" />
        ) : segment.status === 'generating' ? (
          <Loader2 className="size-6 text-white/60 animate-spin" />
        ) : (
          <ClapperboardIcon className="size-6 text-white/30" />
        )}
        <span className="absolute top-1.5 left-1.5 size-5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold flex items-center justify-center">
          {segment.order}
        </span>
        <Badge variant={badgeCfg.variant} appearance={badgeCfg.appearance} size="sm" className="absolute top-1.5 left-8 shadow-sm">
          {segment.status}
        </Badge>
        {segment.hasCharacter && (
          <Badge variant="secondary" appearance="outline" size="sm" className="absolute top-1.5 right-1.5 bg-black/40! text-white! border-white/20!">
            on camera
          </Badge>
        )}
        {segment.duration && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono">
            {segment.duration.toFixed?.(1) ?? segment.duration}s
          </span>
        )}
      </div>
      <div className="p-2 space-y-1.5 flex-1 flex flex-col">
        <div className="flex-1 space-y-1.5">
          <ShotText label="Shot" text={segment.visualDescription} />
          <ShotText label="Narration" text={segment.spokenPortion || '—'} quoted />
        </div>
        {segment.errorMessage && <p className="text-[10px] text-destructive bg-destructive/5 border border-destructive/10 rounded p-1 line-clamp-2">{segment.errorMessage}</p>}
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
          {regenerateMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          {showNote ? 'Confirm regenerate' : 'Regenerate'}
        </Button>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-7 text-[11px] px-1"
            onClick={() => { setShowUrlForm((v) => !v); setUrlValue(segment.videoUrl || ''); setDurationValue(segment.duration ?? ''); }}
          >
            <LinkIcon className="size-3" />
            {segment.videoUrl ? 'Edit URL' : 'Set URL'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 h-7 text-[11px] px-1"
            onClick={() => setShowVersions((v) => !v)}
            disabled={!versions.length}
          >
            <History className="size-3" />
            {versions.length ? `Versions (${versions.length})` : 'No versions'}
          </Button>
        </div>

        {showUrlForm && (
          <div className="space-y-1.5 border rounded p-1.5 bg-muted/30">
            <Input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://…/clip.mp4"
              className="h-7 text-[11px]"
            />
            <Input
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              placeholder="Duration in seconds (optional)"
              type="number"
              step="0.1"
              className="h-7 text-[11px]"
            />
            <Button
              size="sm"
              className="w-full h-7 text-[11px]"
              onClick={() => setUrlMutation.mutate()}
              disabled={setUrlMutation.isPending || !urlValue.trim()}
            >
              {setUrlMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Save clip
            </Button>
          </div>
        )}

        {showVersions && (
          <div className="space-y-1 border rounded p-1.5 bg-muted/30 max-h-56 overflow-y-auto">
            {versions.map((v) => {
              const isActive = v.id === segment.activeVersionId;
              return (
                <div key={v.id} className={`rounded border p-1 space-y-1 ${isActive ? 'border-primary bg-primary/5' : 'bg-card'}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold">
                      v{v.version}
                      {v.source === 'manual' && <span className="ml-1 font-normal text-muted-foreground">manual</span>}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{format(new Date(v.createdAt), 'MMM d, HH:mm')}</span>
                  </div>
                  {v.videoUrl && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={v.videoUrl} controls className="w-full rounded bg-black" />
                  )}
                  {v.note && <p className="text-[9px] text-muted-foreground line-clamp-2 italic">{v.note}</p>}
                  {isActive ? (
                    <p className="text-[9px] text-primary font-medium text-center">Currently used</p>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-6 text-[10px]"
                      onClick={() => restoreMutation.mutate(v.id)}
                      disabled={restoreMutation.isPending}
                    >
                      {restoreMutation.isPending ? <Loader2 className="size-2.5 animate-spin" /> : <RotateCcw className="size-2.5" />}
                      Use this take
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentTimeline — segment strip + music lane + re-assemble
// ---------------------------------------------------------------------------
function SegmentTimeline({ post, invalidate }) {
  const notify = postToast(post);
  const [musicVolume, setMusicVolume] = useState([post.musicVolume ?? 0.3]);
  const [preMuteVolume, setPreMuteVolume] = useState(post.musicVolume || 0.3);
  const [captionsEnabled, setCaptionsEnabled] = useState(post.captionsEnabled ?? true);
  const [musicNote, setMusicNote] = useState('');
  const [showMusicNote, setShowMusicNote] = useState(false);
  const [justStarted, setJustStarted] = useState(false);

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
    onError: (e) => notify.error(e.message),
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
    onError: (e) => notify.error(e.message),
  });

  const regenerateMusicMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/regenerate-music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: musicNote || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Could not start music regeneration');
      }
      return res.json();
    },
    onSuccess: () => {
      setJustStarted(true);
      notify.success('Regenerating music — you can leave this page');
      setShowMusicNote(false);
      setMusicNote('');
      invalidate();
    },
    onError: (e) => notify.error(`Could not start music regeneration: ${e.message}`),
  });

  const continueMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/continue`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Could not continue shoot');
      }
      return res.json();
    },
    onSuccess: () => { notify.success('Continuing the shoot — you can leave this page'); invalidate(); },
    onError: (e) => notify.error(`Could not continue: ${e.message}`),
  });

  const reassembleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/reassemble`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Could not start re-assembly');
      }
      return res.json();
    },
    onSuccess: () => { setJustStarted(true); notify.success('Assembling — you can leave this page'); invalidate(); },
    onError: (e) => notify.error(`Could not start assembly: ${e.message}`),
  });

  // Assembly runs server-side and outlives the request, so progress is read
  // from the pipeline's own log rows. Polling unconditionally also means a
  // page reload mid-assembly still shows where it's up to.
  const { data: progressLogs } = useQuery({
    queryKey: ['video-post-logs', post.id],
    queryFn: async () => {
      const res = await apiFetch(`/api/video/posts/${post.id}/logs`);
      if (!res.ok) return [];
      const j = await res.json();
      return j.data ?? [];
    },
    refetchInterval: (query) =>
      justStarted || (query.state.data ?? []).some((l) => l.status === 'running') ? 1500 : 5000,
  });

  const runningStep = progressLogs?.find(
    (l) => l.status === 'running' && (l.step?.startsWith('assembly') || l.step?.startsWith('music')),
  );
  // justStarted covers the gap between the click and the first log row landing.
  const isAssembling = Boolean(runningStep) || justStarted;
  const currentStep = runningStep || (justStarted ? progressLogs?.[0] : null);

  useEffect(() => {
    if (!justStarted) return undefined;
    if (runningStep) {
      setJustStarted(false);
      return undefined;
    }
    // Short jobs can finish before a running row is ever observed — don't let
    // the spinner outlive the work.
    const timer = setTimeout(() => setJustStarted(false), 30000);
    return () => clearTimeout(timer);
  }, [justStarted, runningStep]);

  const segments = post.segments || [];
  const completedCount = segments.filter((s) => s.status === 'completed').length;
  const canAssemble = completedCount > 0;
  // An interrupted shoot leaves gaps. Continuing reuses the clips Higgsfield
  // already billed for; re-approving the plan would pay to shoot them again.
  const missingCount = segments.filter((s) => !s.videoUrl).length;
  const canContinue = Boolean(post.directorSessionId) && missingCount > 0
    && !segments.some((s) => s.status === 'generating');

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle className="text-sm flex items-center gap-2">
            <Film className="size-4 text-muted-foreground" />
            Segment Timeline
          </CardTitle>
          <CardDescription className="text-xs">
            {completedCount}/{segments.length} segments generated — regenerate any segment, then re-assemble when ready.
          </CardDescription>
        </CardHeading>
        <CardToolbar>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-3" />{formatMs(post.totalGenerationTimeMs)}</span>
            <span className="flex items-center gap-1" title="Includes rate-card Higgsfield estimates — exact for music/captions">
              <DollarSign className="size-3" />~{formatCost(post.totalEstimatedCost)}
            </span>
          </div>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-5">
        {canContinue && (
          <Alert variant="warning" appearance="light">
            <AlertIcon><AlertCircle /></AlertIcon>
            <div className="flex-1 flex items-center justify-between gap-3">
              <AlertTitle className="text-xs">
                {missingCount} segment{missingCount !== 1 ? 's' : ''} never came back — the shoot was interrupted. Continue picks up in
                the same session and reuses clips Higgsfield already charged for, instead of reshooting the whole video.
              </AlertTitle>
              <Button size="sm" onClick={() => continueMutation.mutate()} disabled={continueMutation.isPending}>
                {continueMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
                Continue
              </Button>
            </div>
          </Alert>
        )}

        <div className="flex gap-3 overflow-x-auto pb-2">
          {segments.map((segment) => (
            <SegmentBlock key={segment.id} segment={segment} post={post} invalidate={invalidate} />
          ))}
        </div>

        <Separator />

        <div className="rounded-lg bg-muted/40 border border-border/60 p-3.5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <div className="size-6 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Music className="size-3.5 text-purple-600" />
            </div>
            Music lane
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
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
            <span className="text-xs text-muted-foreground w-10 text-right font-mono">{Math.round(musicVolume[0] * 100)}%</span>
          </div>
          {post.musicUrl && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio src={post.musicUrl} controls className="w-full h-8" />
          )}

          {post.narrationVideoUrl && (
            <>
              {showMusicNote && (
                <Textarea
                  value={musicNote}
                  onChange={(e) => setMusicNote(e.target.value)}
                  placeholder="Direction for the new track (optional) — e.g. more upbeat, less percussion…"
                  rows={2}
                  className="text-xs"
                />
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs"
                onClick={() => (showMusicNote ? regenerateMusicMutation.mutate() : setShowMusicNote(true))}
                disabled={regenerateMusicMutation.isPending || musicVolume[0] === 0}
                title={musicVolume[0] === 0 ? 'Unmute the music lane first' : undefined}
              >
                {regenerateMusicMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                {showMusicNote ? 'Confirm regenerate music' : 'Regenerate music'}
              </Button>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5"><Captions className="size-3.5" /> Captions (9:16 only)</Label>
            <Switch
              checked={captionsEnabled}
              onCheckedChange={(v) => { setCaptionsEnabled(v); saveCaptionsMutation.mutate(v); }}
            />
          </div>
        </div>

        {isAssembling && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-lg px-3 py-2">
            <Loader2 className="size-3.5 animate-spin shrink-0" />
            <span className="truncate">{currentStep?.message || 'Starting…'}</span>
          </div>
        )}

        <Button className="w-full" onClick={() => reassembleMutation.mutate()} disabled={!canAssemble || reassembleMutation.isPending}>
          {reassembleMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Re-assemble
        </Button>

        {post.videoUrl && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Assembled video</Label>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={post.videoUrl} controls className="w-full max-w-xs mx-auto rounded-lg bg-black border shadow-sm" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PublishToControl — per-video editable channel selection + schedule
// date/time. Unlike Social (one SocialPost row per fixed platform), one
// video can fan out to several Buffer channels at once, so this is a single
// editable control rather than read-only per-channel badges.
// ---------------------------------------------------------------------------
function PublishToControl({ post, invalidate }) {
  const notify = postToast(post);
  const [platforms, setPlatforms] = useState(post.platforms || []);
  const [scheduledAt, setScheduledAt] = useState(post.scheduledAt ? toLocalDatetimeInputValue(post.scheduledAt) : '');

  useEffect(() => {
    setPlatforms(post.platforms || []);
    setScheduledAt(post.scheduledAt ? toLocalDatetimeInputValue(post.scheduledAt) : '');
  }, [post.platforms, post.scheduledAt]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiFetch(`/api/video/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => invalidate(),
    onError: (e) => notify.error(e.message),
  });

  const isScheduled = Boolean(post.bufferPostIds && Object.keys(post.bufferPostIds).length > 0);

  function togglePlatform(key) {
    if (isScheduled) return;
    const next = platforms.includes(key) ? platforms.filter((p) => p !== key) : [...platforms, key];
    setPlatforms(next);
    saveMutation.mutate({ platforms: next });
  }

  function handleDateChange(e) {
    const v = e.target.value;
    setScheduledAt(v);
    saveMutation.mutate({ scheduledAt: v ? new Date(v).toISOString() : null });
  }

  return (
    <div className="space-y-2.5">
      <Label className="text-xs font-medium">Publish to</Label>
      <div className="flex flex-wrap gap-2">
        {VIDEO_PLATFORM_OPTIONS.map(({ key, label, Icon }) => {
          const active = platforms.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => togglePlatform(key)}
              disabled={isScheduled}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              } ${isScheduled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Scheduled date/time</Label>
          <Input type="datetime-local" value={scheduledAt} onChange={handleDateChange} disabled={isScheduled} />
        </div>
        {post.article?.publishDate && (
          <p className="text-xs text-muted-foreground">
            Article publishes {format(new Date(post.article.publishDate), 'MMM d, yyyy \u00b7 h:mm a')}
          </p>
        )}
      </div>
      {isScheduled && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Already scheduled on Buffer — unschedule first to change channels/time.</p>
      )}
    </div>
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
      const data = query.state.data;
      // Work now runs server-side past the request, so polling is the only
      // thing that reports it finishing — including a lone segment being
      // regenerated on an otherwise idle post.
      const busy = data?.status === 'planning' || data?.status === 'directing' || data?.status === 'approved'
        || data?.status === 'shooting_stills'
        || (data?.segments || []).some((s) => s.status === 'generating');
      return busy ? 4000 : 8000;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['video-post', postId] });
  const notify = postToast(post ?? { id: postId });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/export`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start export');
    },
    onSuccess: () => { notify.success('Export started'); invalidate(); },
    onError: (e) => notify.error(`Export failed: ${e.message}`),
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/schedule`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to schedule');
      }
    },
    onSuccess: () => { notify.success('Scheduled via Buffer'); invalidate(); },
    onError: (e) => notify.error(`Scheduling failed: ${e.message}`),
  });

  const unscheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/unschedule`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to unschedule');
    },
    onSuccess: () => { notify.success('Removed from Buffer'); invalidate(); },
    onError: (e) => notify.error(e.message),
  });

  const analyticsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/posts/${postId}/analytics`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pull analytics');
      return res.json();
    },
    onSuccess: () => { notify.success('Analytics updated'); invalidate(); },
    onError: (e) => notify.error(e.message),
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

  // Plan review is never hidden once a plan exists — even after execution,
  // you might not like the result and want to look back at (or redraft) the
  // plan that produced it, without losing the already-generated segments.
  const showPlanReview = Boolean(post.plan) || post.status === 'planning';
  const showTimeline = (post.segments || []).some((s) => s.videoUrl || s.status !== 'pending');
  const alreadyExecuted = (post.segments || []).some((s) => s.videoUrl);
  // Like plan review, the frames stay on screen after the shoot — if a clip
  // came out wrong you want to see the frame it started from.
  const showStillsReview = Boolean(post.anchorStillUrl) || post.status === 'shooting_stills';
  const badgeCfg = STATUS_BADGE[post.status] ?? { variant: 'secondary', appearance: 'light' };

  return (
    <Container>
      <div className="flex items-start gap-3 mb-5">
        <Button variant="ghost" size="icon" onClick={() => router.push(post.campaignId ? `/dashboard/video/${post.campaignId}` : '/dashboard/video/custom')} className="mt-0.5">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{post.campaignId ? 'Video Post' : 'Custom Video'}</p>
          <div className="flex items-start gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold truncate max-w-full">{post.article?.title || post.customTitle || 'Untitled video'}</h1>
            <Badge variant={badgeCfg.variant} appearance={badgeCfg.appearance} size="sm" className="mt-1">
              {post.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {post.duration && <Badge variant="secondary" appearance="light" size="sm">{post.duration}s</Badge>}
            {(post.aspectRatio || post.orientation) && <Badge variant="secondary" appearance="light" size="sm">{post.aspectRatio || post.orientation}</Badge>}
            {post.genre && <Badge variant="secondary" appearance="light" size="sm">{post.genre}</Badge>}
          </div>
        </div>
      </div>

      {post.errorMessage && (
        <Alert variant="destructive" appearance="light" className="mb-5">
          <AlertIcon><AlertCircle className="size-4" /></AlertIcon>
          <AlertTitle>{post.errorMessage}</AlertTitle>
        </Alert>
      )}

      <div className="space-y-4">
        {showPlanReview && (
          <>
            <VideoConfigCard post={post} invalidate={invalidate} />
            <PlanReviewCard post={post} invalidate={invalidate} alreadyExecuted={alreadyExecuted} />
          </>
        )}

        {showStillsReview && (
          <StillsReviewCard post={post} invalidate={invalidate} alreadyExecuted={alreadyExecuted} />
        )}

        {showTimeline && <SegmentTimeline post={post} invalidate={invalidate} />}

        <Card>
          <CardHeader>
            <CardHeading>
              <CardTitle className="text-sm">Caption & Publishing</CardTitle>
            </CardHeading>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <Textarea value={post.generatedText || ''} readOnly rows={3} className="text-xs" placeholder="Caption will appear here once planned" />
            {post.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.hashtags.map((tag) => (
                  <Badge key={tag} variant="info" appearance="light" size="sm">
                    <Hash className="size-2.5" />{tag.replace(/^#/, '')}
                  </Badge>
                ))}
              </div>
            )}

            <Separator />
            <PublishToControl post={post} invalidate={invalidate} />
            <Separator />

            <div className="flex flex-wrap gap-1.5">
              {post.videoUrl && post.status !== 'uploaded' && post.status !== 'scheduled' && (
                <Button size="sm" variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
                  {exportMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  Export
                </Button>
              )}
              {post.status === 'uploaded' && (
                <Button size="sm" onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending}>
                  {scheduleMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarClock className="size-3.5" />}
                  Send to Buffer
                </Button>
              )}
              {post.bufferPostIds && Object.keys(post.bufferPostIds).length > 0 && (
                <Button size="sm" variant="outline" onClick={() => unscheduleMutation.mutate()} disabled={unscheduleMutation.isPending}>
                  <XCircle className="size-3.5" />
                  Unschedule
                </Button>
              )}
              {post.status === 'scheduled' && (
                <Button size="sm" variant="outline" onClick={() => analyticsMutation.mutate()} disabled={analyticsMutation.isPending}>
                  <TrendingUp className="size-3.5" />
                  Analytics
                </Button>
              )}
            </div>

            {post.analyticsData && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                {Object.entries(post.analyticsData).filter(([k]) => k !== 'pulledAt').map(([platform, m]) => (
                  <div key={platform} className="border rounded-lg p-2.5 bg-muted/20">
                    <p className="font-medium capitalize">{platform.replace(/_/g, ' ')}</p>
                    <p className="text-muted-foreground mt-0.5">{m.impressions ?? 0} impressions</p>
                    <p className="text-muted-foreground">{m.likes ?? 0} likes</p>
                  </div>
                ))}
              </div>
            )}

            <Collapsible open={showLog} onOpenChange={setShowLog}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={`size-3.5 transition-transform ${showLog ? 'rotate-180' : ''}`} />
                  Planner: {post.planSessionId ? post.planSessionId.slice(0, 12) + '…' : 'not started'} · Director: {post.directorSessionId ? post.directorSessionId.slice(0, 12) + '…' : 'not started'}
                </button>
              </CollapsibleTrigger>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
