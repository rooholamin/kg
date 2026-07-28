'use client';

import { useState, useEffect } from 'react';
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
import { ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle, Save } from 'lucide-react';

function CharacterCard({ section }) {
  const queryClient = useQueryClient();
  const [outfit, setOutfit] = useState(section.videoOutfitDescription || '');

  useEffect(() => setOutfit(section.videoOutfitDescription || ''), [section.videoOutfitDescription]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['video-characters'] });

  const trainMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/characters/${section.id}/train`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Training failed');
      }
      return res.json();
    },
    onSuccess: () => { toast.success(`Trained a Soul Character for ${section.name}`); invalidate(); },
    onError: (e) => toast.error(e.message),
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
          {isTrained ? (
            <Badge className="shrink-0"><CheckCircle2 className="size-3 mr-1" />Trained</Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0"><AlertCircle className="size-3 mr-1" />Not trained</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isTrained && (
          <p className="text-xs text-muted-foreground font-mono truncate">characterId: {section.videoCharacterId}</p>
        )}

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
            disabled={trainMutation.isPending || (!section.characterImage && !section.videoRefImageUrls?.length)}
          >
            {trainMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
            {isTrained ? 'Retrain' : 'Train'} Character
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
