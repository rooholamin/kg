'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiFetch } from '@/lib/api';
import { CreateCustomVideoDialog } from '@/components/video/create-custom-video-dialog';
import { ArrowLeft, Plus, Loader2, ClapperboardIcon, ChevronRight } from 'lucide-react';

const POST_STATUS_BADGE = {
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

function CustomVideoCard({ post }) {
  const router = useRouter();
  const segments = post.segments || [];
  const completedCount = segments.filter((s) => s.status === 'completed').length;
  const progressPct = segments.length > 0 ? Math.round((completedCount / segments.length) * 100) : 0;
  const badgeCfg = POST_STATUS_BADGE[post.status] ?? { variant: 'secondary', appearance: 'light' };
  const characterName = post.customCharacter?.name
    || post.customSection?.characterName
    || post.customSection?.name;

  return (
    <Card
      className="cursor-pointer group overflow-hidden hover:shadow-md hover:border-primary/40 transition-all duration-200"
      onClick={() => router.push(`/dashboard/video/posts/${post.id}`)}
    >
      <div className="relative bg-black h-52 flex items-center justify-center overflow-hidden">
        {post.videoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={post.videoUrl} controls className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />
        ) : (
          <ClapperboardIcon className="size-8 text-white/20" />
        )}
        <Badge variant={badgeCfg.variant} appearance={badgeCfg.appearance} size="sm" className="absolute top-2 left-2 shadow-sm">
          {post.status.replace(/_/g, ' ')}
        </Badge>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{post.customTitle || 'Untitled video'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {characterName ? `Featuring ${characterName}` : 'No character'}
            {segments.length > 0 ? ` — ${completedCount}/${segments.length} segments generated` : ' — No plan yet'}
          </p>
        </div>
        {segments.length > 0 && <Progress value={progressPct} className="h-1" />}
        <div className="flex justify-end">
          <span className="flex items-center gap-0.5 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View <ChevronRight className="size-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomVideosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['video-custom-posts'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/custom-posts');
      if (!res.ok) throw new Error('Failed to load custom videos');
      const j = await res.json();
      return j.data ?? [];
    },
    refetchInterval: 10000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['video-custom-posts'] });

  return (
    <Container>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/video')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Custom Videos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Standalone videos with your own content and a chosen character — not tied to any campaign.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          Create Custom Video
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 border-2 border-dashed rounded-xl">
          <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
            <ClapperboardIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">No custom videos yet</p>
            <p className="text-sm text-muted-foreground mt-1">Provide your own content and pick a character to get started.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            Create your first one
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p) => <CustomVideoCard key={p.id} post={p} />)}
        </div>
      )}

      <CreateCustomVideoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        endpoint="/api/video/custom-posts"
        onCreated={(post) => { invalidate(); router.push(`/dashboard/video/posts/${post.id}`); }}
      />
    </Container>
  );
}
