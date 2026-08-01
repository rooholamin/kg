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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { Loader2, Clapperboard } from 'lucide-react';

/**
 * Shared "Create Custom Video" form — content you provide directly (no
 * article) plus a character picked from the standalone roster. Used both
 * attached to an existing campaign (POST /api/video/campaigns/[id]/custom-posts)
 * and standalone (POST /api/video/custom-posts).
 */
export function CreateCustomVideoDialog({ open, onOpenChange, endpoint, onCreated }) {
  const [title, setTitle] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [content, setContent] = useState('');

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

  const trainedRoster = roster.filter((c) => c.videoCharacterId);

  function reset() {
    setTitle('');
    setCharacterId('');
    setContent('');
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, characterId, content }),
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

  const canSubmit = title.trim() && characterId && content.trim();

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
            <Select value={characterId} onValueChange={setCharacterId}>
              <SelectTrigger><SelectValue placeholder="Select a trained character" /></SelectTrigger>
              <SelectContent>
                {trainedRoster.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No trained characters yet — add one from Video → Characters.</div>
                ) : (
                  trainedRoster.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
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
