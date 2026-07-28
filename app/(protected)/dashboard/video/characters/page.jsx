'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle, Save, Upload, X, ImagePlus } from 'lucide-react';

// ---------------------------------------------------------------------------
// Reference image uploader — additional shots beyond the primary
// characterImage (which is set on the Sections page). Uploads go through the
// same /api/uploads endpoint (directory: 'characters') the Sections form
// uses for characterImage, then append the returned URL onto
// Section.videoRefImageUrls via PATCH /api/video/characters/[sectionId].
// ---------------------------------------------------------------------------
function RefImageGrid({ section }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const urls = section.videoRefImageUrls || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['video-characters'] });

  const saveUrlsMutation = useMutation({
    mutationFn: async (nextUrls) => {
      const res = await apiFetch(`/api/video/characters/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoRefImageUrls: nextUrls }),
      });
      if (!res.ok) throw new Error('Failed to save reference images');
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  });

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('directory', 'characters');
        const res = await apiFetch('/api/uploads', { method: 'POST', body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || `Failed to upload ${file.name}`);
        }
        const { data } = await res.json();
        uploaded.push(data.url);
      }
      await saveUrlsMutation.mutateAsync([...urls, ...uploaded]);
      toast.success(`Uploaded ${uploaded.length} reference image${uploaded.length !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeUrl(url) {
    saveUrlsMutation.mutate(urls.filter((u) => u !== url));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Additional reference images ({urls.length})</Label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {urls.length > 0 ? (
        <div className="grid grid-cols-4 gap-1.5">
          {urls.map((url) => (
            <div key={url} className="relative group aspect-square rounded-md overflow-hidden border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Reference" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeUrl(url)}
                className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed rounded-md p-2.5">
          <ImagePlus className="size-3.5 shrink-0" />
          No extra reference shots yet — 2-4 more (different angles/expressions) improves training quality.
        </div>
      )}
    </div>
  );
}

function CharacterCard({ section }) {
  const queryClient = useQueryClient();
  const [outfit, setOutfit] = useState(section.videoOutfitDescription || '');

  useEffect(() => setOutfit(section.videoOutfitDescription || ''), [section.videoOutfitDescription]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['video-characters'] });

  // Training itself takes minutes on Higgsfield's side, but the request now
  // returns immediately (see higgsfield.service.js's createCharacter) — this
  // mutation only waits for that quick "training started" response, not for
  // training to finish. Actual progress is polled separately below.
  const trainMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/characters/${section.id}/train`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Training failed to start');
      }
      return res.json();
    },
    onSuccess: () => { toast.success(`Training started for ${section.name} — takes a few minutes`); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  // Polls Higgsfield directly for this character's current training status.
  // Auto-refreshes every 10s whenever a character ID exists and hasn't
  // reached a terminal state yet, so the badge below updates on its own.
  const { data: liveStatus } = useQuery({
    queryKey: ['video-character-status', section.id, section.videoCharacterId],
    queryFn: async () => {
      const res = await apiFetch(`/api/video/characters/${section.id}/status`);
      if (!res.ok) return null;
      const j = await res.json();
      return j.data;
    },
    enabled: Boolean(section.videoCharacterId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 10000;
    },
  });

  const saveOutfitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/characters/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoOutfitDescription: outfit }),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => { toast.success('Outfit description saved'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const isTrained = Boolean(section.videoCharacterId);
  const status = liveStatus?.status; // 'queued' | 'in_progress' | 'completed' | 'failed' | undefined (not checked yet)

  const STATUS_BADGE = {
    completed: { label: 'Trained', icon: CheckCircle2, variant: 'default' },
    in_progress: { label: 'Training…', icon: Loader2, variant: 'secondary', spin: true },
    queued: { label: 'Queued', icon: Loader2, variant: 'secondary', spin: true },
    failed: { label: 'Training failed', icon: AlertCircle, variant: 'destructive' },
  };
  const badge = isTrained ? (STATUS_BADGE[status] ?? { label: 'Checking…', icon: Loader2, variant: 'secondary', spin: true }) : { label: 'Not trained', icon: AlertCircle, variant: 'secondary' };
  const BadgeIcon = badge.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {section.characterImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={section.characterImage} alt={section.characterName || section.name} className="size-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="size-10 rounded-full bg-muted shrink-0" />
            )}
            <div className="min-w-0">
              <CardTitle className="text-sm truncate">{section.name}</CardTitle>
              <CardDescription className="text-xs truncate">{section.characterName || 'No character name set'}</CardDescription>
            </div>
          </div>
          <Badge variant={badge.variant} className="shrink-0">
            <BadgeIcon className={`size-3 mr-1 ${badge.spin ? 'animate-spin' : ''}`} />
            {badge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isTrained && (
          <p className="text-xs text-muted-foreground font-mono truncate">characterId: {section.videoCharacterId}</p>
        )}

        <RefImageGrid section={section} />

        <div className="space-y-1">
          <Label className="text-xs">Outfit description (for the director agent's prompts)</Label>
          <Textarea
            rows={3}
            value={outfit}
            onChange={(e) => setOutfit(e.target.value)}
            placeholder="e.g. tailored charcoal blazer over a white shirt, no tie, sleeves occasionally rolled"
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => saveOutfitMutation.mutate()} disabled={saveOutfitMutation.isPending || outfit === (section.videoOutfitDescription || '')}>
            {saveOutfitMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
            Save Outfit
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (isTrained && !window.confirm(`Retrain the Soul Character for ${section.name}? This creates a new character ID.`)) return;
              trainMutation.mutate();
            }}
            disabled={
              trainMutation.isPending ||
              status === 'queued' ||
              status === 'in_progress' ||
              (!section.characterImage && !section.videoRefImageUrls?.length)
            }
          >
            {trainMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
            {status === 'queued' || status === 'in_progress' ? 'Training in progress…' : isTrained ? 'Retrain' : 'Train'} Character
          </Button>
        </div>

        {!section.characterImage && !section.videoRefImageUrls?.length && (
          <p className="text-xs text-amber-600">Set a characterImage on this section first (Sections admin) before training.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function VideoCharactersPage() {
  const router = useRouter();
  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['video-characters'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/characters');
      if (!res.ok) throw new Error('Failed to load characters');
      const j = await res.json();
      return j.data ?? [];
    },
  });

  return (
    <Container>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/video')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Video Characters</h1>
          <p className="text-sm text-muted-foreground">
            One Higgsfield Soul Character per section — the on-screen avatar every video for that section uses.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {sections.map((s) => <CharacterCard key={s.id} section={s} />)}
        </div>
      )}
    </Container>
  );
}
