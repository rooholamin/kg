'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { Loader2, Clapperboard, MapPin } from 'lucide-react';

/**
 * Shared "Create Custom Video" form — content you provide directly (no
 * article) plus a character, which can be either a standalone roster
 * character or an existing section's already-trained one. Used both attached
 * to an existing campaign (POST /api/video/campaigns/[id]/custom-posts) and
 * standalone (POST /api/video/custom-posts).
 */
export function CreateCustomVideoDialog({ open, onOpenChange, endpoint, onCreated }) {
  const [title, setTitle] = useState('');
  // "section:<id>" or "roster:<id>" — the picker spans two different sources
  const [castValue, setCastValue] = useState('');
  const [content, setContent] = useState('');
  const [environmentName, setEnvironmentName] = useState('');
  const [environmentDescription, setEnvironmentDescription] = useState('');
  const [showEnvironment, setShowEnvironment] = useState(false);

  const { data: roster = [] } = useQuery({
    queryKey: ['video-character-roster'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/characters/roster');
      if (!res.ok) return [];
      const j = await res.json();
      return j.data ?? [];
    },
    enabled: open,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['video-section-characters'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/characters');
      if (!res.ok) return [];
      const j = await res.json();
      return j.data ?? [];
    },
    enabled: open,
  });

  const trainedRoster = roster.filter((c) => c.videoCharacterId);
  const trainedSections = sections.filter((s) => s.videoCharacterId);
  const hasAnyCharacter = trainedRoster.length > 0 || trainedSections.length > 0;

  function reset() {
    setTitle('');
    setCastValue('');
    setContent('');
    setEnvironmentName('');
    setEnvironmentDescription('');
    setShowEnvironment(false);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const [source, id] = castValue.split(':');
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          ...(source === 'section' ? { sectionId: id } : { characterId: id }),
          environmentName,
          environmentDescription,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to create custom video');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success('Custom video created — planning in the background');
      reset();
      onOpenChange(false);
      onCreated?.(data.data);
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit = title.trim() && castValue && content.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Custom Video</DialogTitle>
          <DialogDescription className="text-xs">
            Provide your own content instead of an article — the Planner Agent still turns it into narration and segments.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 5 Tips for a Cozy Reading Nook" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Character</Label>
            <Select value={castValue} onValueChange={setCastValue}>
              <SelectTrigger><SelectValue placeholder="Select a trained character" /></SelectTrigger>
              <SelectContent>
                {!hasAnyCharacter && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No trained characters yet — add one from Video → Characters.</div>
                )}
                {trainedSections.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Sections</SelectLabel>
                    {trainedSections.map((s) => (
                      <SelectItem key={s.id} value={`section:${s.id}`}>
                        {s.characterName || s.name}
                        <span className="text-muted-foreground"> · {s.name}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {trainedRoster.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Additional Characters</SelectLabel>
                    {trainedRoster.map((c) => (
                      <SelectItem key={c.id} value={`roster:${c.id}`}>{c.name}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Content / script</Label>
            <Textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the script, brief, or key points you want the video to cover…"
            />
          </div>
          {showEnvironment ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Environment</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    setShowEnvironment(false);
                    setEnvironmentName('');
                    setEnvironmentDescription('');
                  }}
                >
                  Use KG Media Loft
                </Button>
              </div>
              <Input
                value={environmentName}
                onChange={(e) => setEnvironmentName(e.target.value)}
                placeholder="Name — e.g. Sunlit Garden Terrace"
              />
              <Textarea
                rows={4}
                value={environmentDescription}
                onChange={(e) => setEnvironmentDescription(e.target.value)}
                placeholder="Describe the space: architecture, textures, scale, light, colour, mood…"
              />
              <p className="text-xs text-muted-foreground">
                Leave the description blank to fall back to the shared KG Media Loft.
              </p>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowEnvironment(true)}>
              <MapPin className="size-3.5 mr-1.5" />
              Shoot somewhere other than the KG Media Loft
            </Button>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Clapperboard className="size-4 mr-1.5" />}
            Create Video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
