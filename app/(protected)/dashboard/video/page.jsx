'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, subDays } from 'date-fns';
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
import { apiFetch } from '@/lib/api';
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
// Create Campaign Dialog (2 steps: dates → brief)
// ---------------------------------------------------------------------------
function CreateCampaignDialog({ open, onOpenChange, defaultSettings }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const today = useMemo(() => new Date(), []);

  const [scheduleStart, setScheduleStart] = useState(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [scheduleEnd, setScheduleEnd] = useState(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [sameArticleRange, setSameArticleRange] = useState(true);
  const [articleStart, setArticleStart] = useState(format(subDays(today, 30), 'yyyy-MM-dd'));
  const [articleEnd, setArticleEnd] = useState(format(today, 'yyyy-MM-dd'));
  const [maxVideos, setMaxVideos] = useState(defaultSettings?.defaultMaxVideosPerCampaign ?? 5);
  const [editorsChoiceOnly, setEditorsChoiceOnly] = useState(false);
  const [campaignBrief, setCampaignBrief] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/video/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: new Date(scheduleStart).toISOString(),
          weekEnd: new Date(scheduleEnd + 'T23:59:59').toISOString(),
          articleDateStart: sameArticleRange ? null : new Date(articleStart).toISOString(),
          articleDateEnd: sameArticleRange ? null : new Date(articleEnd + 'T23:59:59').toISOString(),
          maxVideos,
          editorsChoiceOnly,
          campaignBrief: campaignBrief || null,
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
    setCampaignBrief('');
    setEditorsChoiceOnly(false);
  }

  const canContinue = Boolean(scheduleStart && scheduleEnd && new Date(scheduleEnd) >= new Date(scheduleStart));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between mb-1">
            <DialogTitle>{step === 1 ? 'Campaign Window' : 'Campaign Brief'}</DialogTitle>
            <span className="text-xs text-muted-foreground font-medium">{step} / 2</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {[1, 2].map((i) => (
              <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            {step === 1
              ? 'Which articles are eligible, how many videos, and the cycle window.'
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Article source</p>
                    <p className="text-xs text-muted-foreground">Which articles&apos; publish dates are eligible.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Same as cycle</span>
                    <Switch checked={sameArticleRange} onCheckedChange={setSameArticleRange} />
                  </div>
                </div>
                {!sameArticleRange && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Start date</Label>
                      <Input type="date" value={articleStart} onChange={(e) => setArticleStart(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">End date</Label>
                      <Input type="date" value={articleEnd} onChange={(e) => setArticleEnd(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 pt-4 border-t">
                <div className="grid grid-cols-2 gap-3 items-center">
                  <Label className="text-sm">Max videos this cycle</Label>
                  <Input type="number" min={1} value={maxVideos} onChange={(e) => setMaxVideos(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-sm font-medium">Editors&apos; choice only</p>
                    <p className="text-xs text-muted-foreground">Only consider editor&apos;s choice articles</p>
                  </div>
                  <Switch checked={editorsChoiceOnly} onCheckedChange={setEditorsChoiceOnly} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
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
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canContinue}>
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
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600">
                <Clapperboard className="size-3" />
                {total} video{total !== 1 ? 's' : ''}
              </span>
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
