'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { videoPlatformConfig } from '@/lib/video-platforms';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Clapperboard,
  Settings,
  Users,
  MapPin,
  Calendar,
  Loader2,
  ChevronRight,
  Zap,
  CheckCircle2,
  Sparkles,
  MousePointerClick,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
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

const TARGET_PLATFORMS = ['auto', 'instagram_reels', 'tiktok', 'youtube_shorts', 'linkedin'];
const VIDEO_STYLES = ['auto', 'explainer', 'diy', 'listicle', 'testimonial'];
const ORIENTATIONS = ['9:16', '16:9', '1:1', '4:5', '3:4', '21:9'];

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DayByDayPicker — manual-mode article browser. Loads eligible articles
// grouped by publish day (most recent first), lets you check up to
// `maxPerDay` per day, and loads more days on demand.
// ---------------------------------------------------------------------------
function DayByDayPicker({ editorsChoiceOnly, maxPerDay, selectedIds, onToggle }) {
  const [days, setDays] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  async function loadMore(before) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (editorsChoiceOnly) params.set('editorsChoiceOnly', 'true');
      if (before) params.set('before', before);
      const res = await apiFetch(`/api/video/campaigns/eligible-articles-by-day?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load eligible articles');
      const j = await res.json();
      setDays((prev) => [...prev, ...(j.data?.days ?? [])]);
      setNextBefore(j.data?.nextBefore ?? null);
      setHasMore(Boolean(j.data?.hasMore));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }

  useEffect(() => {
    setDays([]);
    setNextBefore(null);
    setHasMore(true);
    setLoadedOnce(false);
    loadMore(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorsChoiceOnly]);

  const selectedCountByDay = useMemo(() => {
    const map = new Map();
    for (const { day, articles } of days) {
      map.set(day, articles.filter((a) => selectedIds.has(a.id)).length);
    }
    return map;
  }, [days, selectedIds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{selectedIds.size} article{selectedIds.size !== 1 ? 's' : ''} selected</span>
        <span>Max {maxPerDay} per day</span>
      </div>

      {loadedOnce && days.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">No eligible articles found.</p>
      )}

      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {days.map(({ day, articles }) => {
          const dayCount = selectedCountByDay.get(day) || 0;
          const dayCapped = dayCount >= maxPerDay;
          return (
            <div key={day} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground sticky top-0 bg-background py-1">
                {format(parseISO(day), 'EEEE, MMM d, yyyy')} <span className="opacity-60">({dayCount}/{maxPerDay})</span>
              </p>
              <div className="space-y-1">
                {articles.map((a) => {
                  const checked = selectedIds.has(a.id);
                  const disabled = !checked && dayCapped;
                  return (
                    <label
                      key={a.id}
                      className={`flex items-start gap-2 p-2 rounded-md border text-xs ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => onToggle(a.id, day)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium line-clamp-1">{a.title}</span>
                        {a.sectionName && <span className="text-muted-foreground">{a.sectionName}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => loadMore(nextBefore)} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
          Load more days
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Campaign Dialog — step 1 (window + mode + config), step 2 (agent:
// brief / manual: day-by-day picker)
// ---------------------------------------------------------------------------
function CreateCampaignDialog({ open, onOpenChange, defaultSettings }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const today = useMemo(() => new Date(), []);

  const [scheduleStart, setScheduleStart] = useState(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [scheduleEnd, setScheduleEnd] = useState(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [selectionMode, setSelectionMode] = useState('agent');
  const [maxVideos, setMaxVideos] = useState(defaultSettings?.defaultMaxVideosPerCampaign ?? 5);
  const [editorsChoiceOnly, setEditorsChoiceOnly] = useState(false);
  const [campaignBrief, setCampaignBrief] = useState('');
  const [targetPlatform, setTargetPlatform] = useState(defaultSettings?.defaultTargetPlatform ?? 'auto');
  const [videoStyle, setVideoStyle] = useState(defaultSettings?.defaultVideoStyle ?? 'auto');
  const [targetShotCount, setTargetShotCount] = useState(defaultSettings?.defaultTargetShotCount ?? '');
  const [orientation, setOrientation] = useState(defaultSettings?.defaultOrientation ?? '9:16');
  const [maxPerDay, setMaxPerDay] = useState(2);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (!defaultSettings) return;
    setTargetPlatform(defaultSettings.defaultTargetPlatform ?? 'auto');
    setVideoStyle(defaultSettings.defaultVideoStyle ?? 'auto');
    setTargetShotCount(defaultSettings.defaultTargetShotCount ?? '');
    setOrientation(defaultSettings.defaultOrientation ?? '9:16');
  }, [defaultSettings]);

  function toggleArticle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const isManual = selectionMode === 'manual';
      const res = await apiFetch('/api/video/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: new Date(scheduleStart).toISOString(),
          weekEnd: new Date(scheduleEnd + 'T23:59:59').toISOString(),
          selectionMode,
          editorsChoiceOnly,
          targetPlatform,
          videoStyle,
          targetShotCount: targetShotCount === '' ? null : Number(targetShotCount),
          orientation,
          ...(isManual
            ? { articleIds: Array.from(selectedIds), maxPerDay }
            : { maxVideos, campaignBrief: campaignBrief || null }),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to create campaign');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-campaigns'] });
      toast.success('Campaign created! The pipeline is running in the background.');
      onOpenChange(false);
      router.push(`/dashboard/video/${data.data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function reset() {
    setStep(1);
    setSelectionMode('agent');
    setCampaignBrief('');
    setEditorsChoiceOnly(false);
    setTargetPlatform(defaultSettings?.defaultTargetPlatform ?? 'auto');
    setVideoStyle(defaultSettings?.defaultVideoStyle ?? 'auto');
    setTargetShotCount(defaultSettings?.defaultTargetShotCount ?? '');
    setOrientation(defaultSettings?.defaultOrientation ?? '9:16');
    setMaxPerDay(2);
    setSelectedIds(new Set());
  }

  const canContinue = Boolean(scheduleStart && scheduleEnd && new Date(scheduleEnd) >= new Date(scheduleStart));
  const isManual = selectionMode === 'manual';
  const canSubmit = isManual ? selectedIds.size > 0 : true;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between mb-1">
            <DialogTitle>{step === 1 ? 'Campaign Window' : isManual ? 'Pick Articles' : 'Campaign Brief'}</DialogTitle>
            <span className="text-xs text-muted-foreground font-medium">{step} / 2</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {[1, 2].map((i) => (
              <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            {step === 1
              ? 'Cycle window, selection mode, and plan defaults.'
              : isManual
                ? 'Browse eligible articles day by day and check the ones you want.'
                : 'Optionally guide the Video Approval Agent\u2019s selection.'}
          </p>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Cycle window</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start date</Label>
                    <Input type="date" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End date</Label>
                    <Input type="date" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t">
                <Label className="text-sm font-semibold">Article selection</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectionMode('agent')}
                    className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-colors ${selectionMode === 'agent' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  >
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-sm font-medium">Agent-driven</span>
                    <span className="text-xs text-muted-foreground">The Video Approval Agent picks articles for you</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode('manual')}
                    className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-colors ${selectionMode === 'manual' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  >
                    <MousePointerClick className="size-4 text-primary" />
                    <span className="text-sm font-medium">Manual</span>
                    <span className="text-xs text-muted-foreground">You pick the articles, day by day</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t">
                {isManual ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Max articles per day</p>
                      <p className="text-xs text-muted-foreground">Caps how many you can pick from any single day</p>
                    </div>
                    <Input
                      type="number" min={1} className="w-20"
                      value={maxPerDay}
                      onChange={(e) => setMaxPerDay(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <Label className="text-sm">Max videos this cycle</Label>
                    <Input type="number" min={1} value={maxVideos} onChange={(e) => setMaxVideos(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-sm font-medium">Editors&apos; choice only</p>
                    <p className="text-xs text-muted-foreground">Only consider editor&apos;s choice articles</p>
                  </div>
                  <Switch checked={editorsChoiceOnly} onCheckedChange={setEditorsChoiceOnly} />
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t">
                <Label className="text-sm font-semibold">Plan defaults for this cycle</Label>
                <p className="text-xs text-muted-foreground">
                  Fed to the director agent&apos;s Phase 1 plan for every post — each is still overridable per post.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Target platform</Label>
                    <Select value={targetPlatform} onValueChange={setTargetPlatform}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TARGET_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p.replace(/_/g, ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Video style</Label>
                    <Select value={videoStyle} onValueChange={setVideoStyle}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VIDEO_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Shot count</Label>
                    <Input
                      type="number" min={1} max={12} placeholder="auto"
                      value={targetShotCount}
                      onChange={(e) => setTargetShotCount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Orientation</Label>
                    <Select value={orientation} onValueChange={setOrientation}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORIENTATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && !isManual && (
            <div className="space-y-3">
              <Textarea
                placeholder="e.g. Prioritize market-moving stories this week, feature the Design section…"
                rows={5}
                value={campaignBrief}
                onChange={(e) => setCampaignBrief(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to let the Video Approval Agent choose based on editorial value alone.
              </p>
            </div>
          )}

          {step === 2 && isManual && (
            <DayByDayPicker
              editorsChoiceOnly={editorsChoiceOnly}
              maxPerDay={maxPerDay}
              selectedIds={selectedIds}
              onToggle={toggleArticle}
            />
          )}
        </DialogBody>

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
              Continue
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canContinue || !canSubmit}>
              {mutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Zap className="size-4 mr-1.5" />}
              Launch Campaign
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------
function SummaryStats({ campaigns }) {
  const stats = useMemo(() => {
    let totalPosts = 0;
    let scheduledPosts = 0;
    let activeCampaigns = 0;
    for (const c of campaigns) {
      if (['running', 'approving', 'directing', 'exporting', 'scheduling', 'pending'].includes(c.status)) activeCampaigns++;
      for (const p of c.posts ?? []) {
        totalPosts++;
        if (p.status === 'scheduled') scheduledPosts++;
      }
    }
    return { totalPosts, scheduledPosts, activeCampaigns, totalCampaigns: campaigns.length };
  }, [campaigns]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Campaigns', value: stats.totalCampaigns, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-500/10' },
        { label: 'Active', value: stats.activeCampaigns, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-500/10' },
        { label: 'Total Videos', value: stats.totalPosts, icon: Clapperboard, color: 'text-purple-600', bg: 'bg-purple-500/10' },
        { label: 'Scheduled', value: stats.scheduledPosts, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
      ].map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="flex items-center gap-3 bg-card border rounded-xl p-3.5">
          <div className={`size-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
            <Icon className={`size-4 ${color}`} />
          </div>
          <div>
            <p className="text-xl font-semibold leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign card
// ---------------------------------------------------------------------------
function CampaignCard({ campaign }) {
  const router = useRouter();
  const posts = campaign.posts ?? [];
  const scheduled = posts.filter((p) => p.status === 'scheduled').length;
  const total = posts.length;
  const progressPct = total > 0 ? Math.round((scheduled / total) * 100) : 0;

  const platformCounts = useMemo(() => {
    const counts = {};
    for (const p of posts) {
      for (const key of p.platforms ?? []) {
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return counts;
  }, [posts]);

  const statusBorderColor = {
    pending: 'border-l-zinc-300',
    running: 'border-l-blue-500',
    approving: 'border-l-blue-500',
    directing: 'border-l-indigo-500',
    exporting: 'border-l-indigo-500',
    reviewing: 'border-l-amber-400',
    scheduling: 'border-l-amber-400',
    done: 'border-l-emerald-500',
    failed: 'border-l-red-500',
    cancelled: 'border-l-zinc-300',
    paused: 'border-l-zinc-300',
  }[campaign.status] ?? 'border-l-zinc-300';

  return (
    <Card
      className={`cursor-pointer border-l-4 ${statusBorderColor} hover:shadow-sm transition-all duration-200`}
      onClick={() => router.push(`/dashboard/video/${campaign.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="size-3.5 text-muted-foreground shrink-0" />
              <p className="text-sm font-semibold text-foreground">
                {format(parseISO(String(campaign.weekStart)), 'MMM d')} – {format(parseISO(String(campaign.weekEnd)), 'MMM d, yyyy')}
              </p>
            </div>
            {campaign.campaignBrief && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{campaign.campaignBrief}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600">
                <Clapperboard className="size-3" />
                {total} video{total !== 1 ? 's' : ''}
              </span>
              {campaign.selectionMode === 'manual' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">
                  <MousePointerClick className="size-3" />
                  Manual
                </span>
              )}
              {Object.entries(platformCounts).map(([key, count]) => {
                const cfg = videoPlatformConfig(key);
                if (!cfg) return null;
                const { Icon } = cfg;
                return (
                  <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                    <Icon className="size-3" />
                    {count}
                  </span>
                );
              })}
            </div>
            {total > 0 && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{scheduled} of {total} scheduled</span>
                  <span>{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-1" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusPill status={campaign.status} />
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function VideoPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['video-settings'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/settings');
      if (!res.ok) return {};
      const j = await res.json();
      return j.data?.settings ?? {};
    },
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['video-campaigns'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/campaigns');
      if (!res.ok) throw new Error('Failed to load campaigns');
      const j = await res.json();
      return j.data ?? [];
    },
    refetchInterval: 10000,
  });

  return (
    <Container>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Video Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-directed cinematic videos, one per approved article, published through Buffer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/video/custom')}>
            <Clapperboard className="size-4 mr-1.5" />
            Custom Videos
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/video/characters')}>
            <Users className="size-4 mr-1.5" />
            Characters
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/video/environment')}>
            <MapPin className="size-4 mr-1.5" />
            Environment
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/video/settings')}>
            <Settings className="size-4 mr-1.5" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            New Campaign
          </Button>
        </div>
      </div>

      {campaigns.length > 0 && <SummaryStats campaigns={campaigns} />}

      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            All Campaigns
            {campaigns.length > 0 && <span className="ml-2 text-muted-foreground font-normal">{campaigns.length}</span>}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading campaigns…</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 border-2 border-dashed rounded-xl">
            <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
              <Clapperboard className="size-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No campaigns yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Make sure every section has a trained character and the KG Media Loft environment is set up first.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-1.5" />
              Create First Campaign
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        )}
      </div>

      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} defaultSettings={settings} />
    </Container>
  );
}
