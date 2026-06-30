'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { apiFetch } from '@/lib/api';
import {
  Plus,
  Share2,
  Settings,
  Calendar,
  Instagram,
  Loader2,
  ChevronRight,
  Grid3x3,
  Linkedin,
  Twitter,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  CalendarDays,
  ImageIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------
const PLATFORM_CONFIG = {
  instagram_carousel: {
    label: 'IG Carousel',
    icon: Instagram,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
    ring: 'ring-pink-200',
  },
  instagram_story: {
    label: 'IG Story',
    icon: Instagram,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    ring: 'ring-purple-200',
  },
  linkedin: {
    label: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-600',
    bg: 'bg-blue-600/10',
    ring: 'ring-blue-200',
  },
  twitter: {
    label: 'Twitter',
    icon: Twitter,
    color: 'text-zinc-700',
    bg: 'bg-zinc-700/10',
    ring: 'ring-zinc-200',
  },
};

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    dot: 'bg-zinc-400',
  },
  running: {
    label: 'Running',
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dot: 'bg-blue-500 animate-pulse',
  },
  reviewing: {
    label: 'Review',
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  done: {
    label: 'Done',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dot: 'bg-red-500',
  },
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
// Instagram Grid Preview
// ---------------------------------------------------------------------------
function InstagramGridPreview({ campaigns }) {
  const images = useMemo(() => {
    const all = [];
    for (const c of campaigns) {
      for (const p of c.posts ?? []) {
        if (p.platform === 'instagram_carousel' || p.platform === 'instagram_story') {
          if (p.imageUrls?.[0]) all.push({ url: p.imageUrls[0], campaignId: c.id, postId: p.id });
        }
      }
    }
    return all.slice(0, 9);
  }, [campaigns]);

  if (!images.length) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center">
              <Instagram className="size-3.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm">Instagram Grid Preview</CardTitle>
              <CardDescription className="text-xs">Most recent {images.length} posts</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            <Grid3x3 className="size-3 mr-1" />
            {images.length}/9
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden ring-1 ring-border">
          {Array.from({ length: 9 }).map((_, i) => {
            const img = images[i];
            return img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.postId}
                src={img.url}
                alt={`Instagram grid ${i + 1}`}
                className="aspect-square w-full object-cover hover:opacity-90 transition-opacity cursor-pointer"
              />
            ) : (
              <div key={i} className="aspect-square bg-muted flex items-center justify-center">
                <ImageIcon className="size-4 text-muted-foreground/30" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Create Campaign Dialog (3 steps)
// ---------------------------------------------------------------------------
function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-primary w-8'
              : i === current - 1
                ? 'bg-primary w-8'
                : 'bg-muted w-4'
          } ${i + 1 === current ? 'bg-primary' : i + 1 < current ? 'bg-primary/60' : 'bg-muted'}`}
        />
      ))}
    </div>
  );
}

function CreateCampaignDialog({ open, onOpenChange, defaultSettings }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const today = new Date();
  const [weekStart, setWeekStart] = useState(
    format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  );
  const [weekEnd, setWeekEnd] = useState(
    format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  );
  const [maxPosts, setMaxPosts] = useState({
    instagram_carousel: defaultSettings?.defaultMaxInstagramCarousel ?? 3,
    instagram_story: defaultSettings?.defaultMaxInstagramStory ?? 5,
    linkedin: defaultSettings?.defaultMaxLinkedin ?? 3,
    twitter: defaultSettings?.defaultMaxTwitter ?? 7,
  });
  const [editorsChoiceOnly, setEditorsChoiceOnly] = useState(false);
  const [campaignBrief, setCampaignBrief] = useState('');

  const { data: articleCount } = useQuery({
    queryKey: ['campaign-article-count', weekStart, weekEnd],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/articles?publishDateFrom=${weekStart}&publishDateTo=${weekEnd}&status=post_publish&countOnly=true`,
      );
      if (!res.ok) return 0;
      const j = await res.json();
      return j.total ?? j.count ?? 0;
    },
    enabled: Boolean(weekStart && weekEnd),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/social/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: new Date(weekStart).toISOString(),
          weekEnd: new Date(weekEnd + 'T23:59:59').toISOString(),
          maxPostsPerPlatform: maxPosts,
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
      queryClient.invalidateQueries({ queryKey: ['social-campaigns'] });
      toast.success('Campaign created! The pipeline is running in the background.');
      onOpenChange(false);
      router.push(`/dashboard/social/${data.data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function reset() {
    setStep(1);
    setCampaignBrief('');
    setEditorsChoiceOnly(false);
  }

  const STEP_TITLES = ['Select Week', 'Post Limits', 'Campaign Brief'];
  const STEP_DESCRIPTIONS = [
    'Choose the publication week for this campaign.',
    'Set the maximum number of posts per platform.',
    'Optionally guide the AI with a campaign brief.',
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between mb-1">
            <DialogTitle>{STEP_TITLES[step - 1]}</DialogTitle>
            <span className="text-xs text-muted-foreground font-medium">{step} / 3</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                  i + 1 <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">{STEP_DESCRIPTIONS[step - 1]}</p>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Week start</Label>
                  <Input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Week end</Label>
                  <Input
                    type="date"
                    value={weekEnd}
                    onChange={(e) => setWeekEnd(e.target.value)}
                  />
                </div>
              </div>
              {articleCount !== undefined && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/40">
                  <CalendarDays className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <span className="font-semibold">{articleCount}</span> published articles in this period
                  </p>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {Object.entries(maxPosts).map(([platform, val]) => {
                const cfg = PLATFORM_CONFIG[platform];
                const Icon = cfg?.icon ?? Share2;
                return (
                  <div key={platform} className="flex items-center gap-3">
                    <div className={`size-8 rounded-lg ${cfg?.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`size-4 ${cfg?.color}`} />
                    </div>
                    <span className="flex-1 text-sm font-medium">
                      {cfg?.label ?? platform.replace(/_/g, ' ')}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      className="w-20 text-right"
                      value={val}
                      onChange={(e) =>
                        setMaxPosts((p) => ({ ...p, [platform]: Number(e.target.value) }))
                      }
                    />
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-sm font-medium">Editors&apos; choice only</p>
                  <p className="text-xs text-muted-foreground">Only use articles marked as editor&apos;s choice</p>
                </div>
                <Switch
                  checked={editorsChoiceOnly}
                  onCheckedChange={setEditorsChoiceOnly}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <Textarea
                placeholder="e.g. Focus on investment content, skip lifestyle this week…"
                rows={5}
                value={campaignBrief}
                onChange={(e) => setCampaignBrief(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to let the AI select articles based on your default preferences.
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              Continue
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Zap className="size-4 mr-1.5" />
              )}
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
      if (c.status === 'running' || c.status === 'pending') activeCampaigns++;
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
        {
          label: 'Campaigns',
          value: stats.totalCampaigns,
          icon: Calendar,
          color: 'text-blue-600',
          bg: 'bg-blue-500/10',
        },
        {
          label: 'Active',
          value: stats.activeCampaigns,
          icon: Zap,
          color: 'text-amber-600',
          bg: 'bg-amber-500/10',
        },
        {
          label: 'Total Posts',
          value: stats.totalPosts,
          icon: Share2,
          color: 'text-purple-600',
          bg: 'bg-purple-500/10',
        },
        {
          label: 'Scheduled',
          value: stats.scheduledPosts,
          icon: CheckCircle2,
          color: 'text-emerald-600',
          bg: 'bg-emerald-500/10',
        },
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

  const postsByPlatform = useMemo(() => {
    const map = {};
    for (const p of campaign.posts ?? []) {
      map[p.platform] = (map[p.platform] || 0) + 1;
    }
    return map;
  }, [campaign.posts]);

  const posts = campaign.posts ?? [];
  const scheduled = posts.filter((p) => p.status === 'scheduled').length;
  const total = posts.length;
  const progressPct = total > 0 ? Math.round((scheduled / total) * 100) : 0;
  const isActive = campaign.status === 'running' || campaign.status === 'pending';

  const statusBorderColor = {
    pending: 'border-l-zinc-300',
    running: 'border-l-blue-500',
    reviewing: 'border-l-amber-400',
    done: 'border-l-emerald-500',
    failed: 'border-l-red-500',
  }[campaign.status] ?? 'border-l-zinc-300';

  return (
    <Card
      className={`cursor-pointer border-l-4 ${statusBorderColor} hover:shadow-sm transition-all duration-200`}
      onClick={() => router.push(`/dashboard/social/${campaign.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="size-3.5 text-muted-foreground shrink-0" />
              <p className="text-sm font-semibold text-foreground">
                {format(parseISO(String(campaign.weekStart)), 'MMM d')} –{' '}
                {format(parseISO(String(campaign.weekEnd)), 'MMM d, yyyy')}
              </p>
            </div>

            {campaign.campaignBrief && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                {campaign.campaignBrief}
              </p>
            )}

            {/* Platform pills */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(postsByPlatform).map(([platform, count]) => {
                const cfg = PLATFORM_CONFIG[platform];
                const Icon = cfg?.icon ?? Share2;
                return (
                  <span
                    key={platform}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.bg ?? 'bg-muted'} ${cfg?.color ?? 'text-muted-foreground'}`}
                  >
                    <Icon className="size-3" />
                    {count}
                  </span>
                );
              })}
            </div>

            {/* Progress */}
            {total > 0 && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{scheduled} of {total} posts scheduled</span>
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
export default function SocialPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['social-settings'],
    queryFn: async () => {
      const res = await apiFetch('/api/social/settings');
      if (!res.ok) return {};
      const j = await res.json();
      return j.data?.settings ?? {};
    },
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['social-campaigns'],
    queryFn: async () => {
      const res = await apiFetch('/api/social/campaigns');
      if (!res.ok) throw new Error('Failed to load campaigns');
      const j = await res.json();
      return j.data ?? [];
    },
    refetchInterval: 10000,
  });

  return (
    <Container>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Media</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered weekly campaigns across Instagram, LinkedIn & Twitter
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/social/settings')}
          >
            <Settings className="size-4 mr-1.5" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Stats */}
      {campaigns.length > 0 && <SummaryStats campaigns={campaigns} />}

      {/* Instagram grid preview */}
      {campaigns.length > 0 && (
        <div className="mb-6">
          <InstagramGridPreview campaigns={campaigns} />
        </div>
      )}

      {/* Campaigns list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            All Campaigns
            {campaigns.length > 0 && (
              <span className="ml-2 text-muted-foreground font-normal">{campaigns.length}</span>
            )}
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
              <Share2 className="size-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No campaigns yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first campaign to start generating social content.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-1.5" />
              Create First Campaign
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </div>

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultSettings={settings}
      />
    </Container>
  );
}
