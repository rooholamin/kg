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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle, Save, Upload, X, ImagePlus, Plus, Trash2, UserRound } from 'lucide-react';

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

  // Reference Element creation (via the Character Admin Agent's MCP calls)
  // is synchronous — this request resolves once the element actually
  // exists, no separate polling needed.
  const trainMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/characters/${section.id}/train`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to create video character');
      }
      return res.json();
    },
    onSuccess: () => { toast.success(`Video character ready for ${section.name}`); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const { data: liveStatus } = useQuery({
    queryKey: ['video-character-status', section.id, section.videoCharacterId],
    queryFn: async () => {
      const res = await apiFetch(`/api/video/characters/${section.id}/status`);
      if (!res.ok) return null;
      const j = await res.json();
      return j.data;
    },
    enabled: Boolean(section.videoCharacterId),
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
    completed: { label: 'Ready', icon: CheckCircle2, variant: 'default' },
    failed: { label: 'Failed', icon: AlertCircle, variant: 'destructive' },
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
          <p className="text-xs text-muted-foreground font-mono truncate">elementId: {section.videoCharacterId}</p>
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
              if (isTrained && !window.confirm(`Recreate the Reference Element for ${section.name}? This creates a new element ID.`)) return;
              trainMutation.mutate();
            }}
            disabled={
              trainMutation.isPending ||
              (!section.characterImage && !section.videoRefImageUrls?.length)
            }
          >
            {trainMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
            {trainMutation.isPending ? 'Creating…' : isTrained ? 'Recreate' : 'Create'} Character
          </Button>
        </div>

        {!section.characterImage && !section.videoRefImageUrls?.length && (
          <p className="text-xs text-amber-600">Set a characterImage on this section first (Sections admin) before training.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Standalone character roster — additive to the section-tied characters
// above. Used by custom videos, which aren't derived from an article/section
// at all and need to pick a trained character directly.
// ---------------------------------------------------------------------------
function RosterRefImageGrid({ character, invalidate }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const urls = character.referenceImageUrls || [];

  const saveUrlsMutation = useMutation({
    mutationFn: async (nextUrls) => {
      const res = await apiFetch(`/api/video/characters/roster/${character.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceImageUrls: nextUrls }),
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
        <Label className="text-xs">Reference images ({urls.length})</Label>
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
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
          Upload 3-5 reference shots (different angles/expressions) before training.
        </div>
      )}
    </div>
  );
}

function RosterCharacterCard({ character, invalidate }) {
  const [name, setName] = useState(character.name || '');
  const [persona, setPersona] = useState(character.persona || '');
  const [tone, setTone] = useState(character.tone || '');

  useEffect(() => {
    setName(character.name || '');
    setPersona(character.persona || '');
    setTone(character.tone || '');
  }, [character.name, character.persona, character.tone]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/characters/roster/${character.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, persona, tone }),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => { toast.success('Character saved'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const trainMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/characters/roster/${character.id}/train`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to create video character');
      }
      return res.json();
    },
    onSuccess: () => { toast.success(`Video character ready for ${character.name}`); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/video/characters/roster/${character.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete character');
    },
    onSuccess: () => { toast.success('Character deleted'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const isTrained = Boolean(character.videoCharacterId);
  const dirty = name !== (character.name || '') || persona !== (character.persona || '') || tone !== (character.tone || '');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-full bg-muted shrink-0 flex items-center justify-center">
              <UserRound className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm truncate">{character.name}</CardTitle>
              <CardDescription className="text-xs truncate">Custom roster character</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={isTrained ? 'default' : 'secondary'}>
              {isTrained ? <CheckCircle2 className="size-3 mr-1" /> : <AlertCircle className="size-3 mr-1" />}
              {isTrained ? 'Ready' : 'Not trained'}
            </Badge>
            <Button size="icon" variant="ghost" onClick={() => { if (window.confirm(`Delete ${character.name}?`)) deleteMutation.mutate(); }} disabled={deleteMutation.isPending}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isTrained && (
          <p className="text-xs text-muted-foreground font-mono truncate">elementId: {character.videoCharacterId}</p>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Persona / biography</Label>
          <Textarea rows={2} value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Warm, polished, optimistic…" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tone</Label>
          <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Warm, conversational, upbeat" />
        </div>

        <RosterRefImageGrid character={character} invalidate={invalidate} />

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !dirty}>
            {saveMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
            Save
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (isTrained && !window.confirm(`Recreate the Reference Element for ${character.name}? This creates a new element ID.`)) return;
              trainMutation.mutate();
            }}
            disabled={trainMutation.isPending || !character.referenceImageUrls?.length}
          >
            {trainMutation.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
            {trainMutation.isPending ? 'Creating…' : isTrained ? 'Recreate' : 'Create'} Character
          </Button>
        </div>

        {!character.referenceImageUrls?.length && (
          <p className="text-xs text-amber-600">Upload at least one reference image before training.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AddRosterCharacterDialog({ open, onOpenChange, invalidate }) {
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/video/characters/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to create character');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Character added — upload reference images and train it below');
      invalidate();
      setName('');
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Character</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marcus Webb" autoFocus />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !name.trim()}>
            {createMutation.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Plus className="size-3.5 mr-1.5" />}
            Add Character
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VideoCharactersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [addRosterOpen, setAddRosterOpen] = useState(false);

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['video-characters'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/characters');
      if (!res.ok) throw new Error('Failed to load characters');
      const j = await res.json();
      return j.data ?? [];
    },
  });

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['video-character-roster'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/characters/roster');
      if (!res.ok) throw new Error('Failed to load character roster');
      const j = await res.json();
      return j.data ?? [];
    },
  });

  const invalidateRoster = () => queryClient.invalidateQueries({ queryKey: ['video-character-roster'] });

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

      <Separator className="my-8" />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Additional Characters</h2>
          <p className="text-sm text-muted-foreground">
            A standalone roster, not tied to any section — used for custom videos where you pick which character appears.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddRosterOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          Add Character
        </Button>
      </div>

      {rosterLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : roster.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed rounded-xl">
          <UserRound className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No additional characters yet</p>
          <Button size="sm" variant="outline" onClick={() => setAddRosterOpen(true)}>
            <Plus className="size-3.5 mr-1.5" />
            Add your first one
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {roster.map((c) => <RosterCharacterCard key={c.id} character={c} invalidate={invalidateRoster} />)}
        </div>
      )}

      <AddRosterCharacterDialog open={addRosterOpen} onOpenChange={setAddRosterOpen} invalidate={invalidateRoster} />
    </Container>
  );
}
