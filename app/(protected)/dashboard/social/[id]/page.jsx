'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
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

  function saveCaption() {
    onUpdate(post.id, { generatedText: caption });
    setEditingCaption(false);
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

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRegenerate(post.id)}
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
    mutationFn: async (postId) => {
      const res = await apiFetch(`/api/social/posts/${postId}/regenerate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to regenerate');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-campaign', id] });
      toast.success('Regeneration started');
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

      {/* Platform tabs */}
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
                      onRegenerate={(postId) => regenerateMutation.mutate(postId)}
                      onExport={(postId) => exportMutation.mutate(postId)}
                      onPullAnalytics={(postId) => analyticsMutation.mutate(postId)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </Container>
  );
}
