'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns';
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
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import {
  Plus,
  Share2,
  Settings,
  Calendar,
  Instagram,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  Grid3x3,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------
const CAMPAIGN_STATUS_VARIANT = {
  pending: 'secondary',
  running: 'default',
  reviewing: 'outline',
  done: 'default',
  failed: 'destructive',
};

function CampaignStatusBadge({ status }) {
  return (
    <Badge variant={CAMPAIGN_STATUS_VARIANT[status] ?? 'secondary'}>
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Instagram Grid Preview (3-column, most recent 9)
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Grid3x3 className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm">Instagram Grid Preview</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-0.5 rounded overflow-hidden">
          {Array.from({ length: 9 }).map((_, i) => {
            const img = images[i];
            return img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.postId}
                src={img.url}
                alt={`Instagram grid ${i + 1}`}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div key={i} className="aspect-square bg-muted" />
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
          <DialogTitle>New Social Campaign — Step {step}/3</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">Choose the publication week.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Week start</Label>
                  <Input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Week end</Label>
                  <Input
                    type="date"
                    value={weekEnd}
                    onChange={(e) => setWeekEnd(e.target.value)}
                  />
                </div>
              </div>
              {articleCount !== undefined && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{articleCount}</span> published
                  articles in this period.
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-muted-foreground">Max posts per platform this week.</p>
              {Object.entries(maxPosts).map(([platform, val]) => (
                <div key={platform} className="flex items-center justify-between">
                  <Label className="capitalize">{platform.replace(/_/g, ' ')}</Label>
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
              ))}
              <div className="flex items-center justify-between pt-2">
                <Label>Editors' choice only</Label>
                <Switch
                  checked={editorsChoiceOnly}
                  onCheckedChange={setEditorsChoiceOnly}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">
                Optionally give the AI a brief to guide article selection this week.
              </p>
              <Textarea
                placeholder="e.g. Focus on investment content, skip lifestyle this week…"
                rows={5}
                value={campaignBrief}
                onChange={(e) => setCampaignBrief(e.target.value)}
              />
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Create Campaign
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Campaign row card
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

  const scheduled = (campaign.posts ?? []).filter((p) => p.status === 'scheduled').length;
  const total = (campaign.posts ?? []).length;

  return (
    <Card
      className="cursor-pointer hover:border-border/60 transition-colors"
      onClick={() => router.push(`/dashboard/social/${campaign.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Week of {format(parseISO(String(campaign.weekStart)), 'MMM d')} –{' '}
            {format(parseISO(String(campaign.weekEnd)), 'MMM d, yyyy')}
          </CardTitle>
          <CampaignStatusBadge status={campaign.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(postsByPlatform).map(([platform, count]) => (
            <span
              key={platform}
              className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground"
            >
              {platform.replace(/_/g, ' ')}: {count}
            </span>
          ))}
        </div>
        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            {scheduled}/{total} posts scheduled
          </p>
        )}
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Social Media</h1>
          <p className="text-sm text-muted-foreground">
            Manage weekly social campaigns and scheduled posts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/social/settings')}>
            <Settings className="size-4 mr-1.5" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Instagram grid preview */}
      {campaigns.length > 0 && (
        <div className="mb-6">
          <InstagramGridPreview campaigns={campaigns} />
        </div>
      )}

      {/* Campaigns list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Share2 className="size-8 mx-auto mb-2 opacity-30" />
            No campaigns yet. Create one to start the social pipeline.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultSettings={settings}
      />
    </Container>
  );
}
