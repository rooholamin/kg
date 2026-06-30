'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api';
import { ArrowLeft, Loader2, Instagram, Linkedin, LayoutGrid } from 'lucide-react';

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------
const TEMPLATE_REGISTRY = {
  carousel: [
    { id: 'slide-01-cover',       name: 'Cover',          description: 'Hero image full bleed with article title and section. Always first.' },
    { id: 'slide-02-statement',   name: 'Bold Statement', description: 'Single powerful sentence on dark background.' },
    { id: 'slide-03-image-text',  name: 'Image + Text',   description: 'Left image, right narrative paragraph.' },
    { id: 'slide-04-narrative',   name: 'Narrative',      description: 'Text-heavy 2–3 sentence context block.' },
    { id: 'slide-05-pull-quote',  name: 'Pull Quote',     description: 'Prominent expert quote from the article.' },
    { id: 'slide-06-key-stat',    name: 'Key Stat',       description: 'One large number with a short label.' },
    { id: 'slide-07-features',    name: 'Features Grid',  description: 'Four labelled feature points.' },
    { id: 'slide-08-steps',       name: 'Steps',          description: 'Three numbered steps for how-to content.' },
    { id: 'slide-09-full-image',  name: 'Full Image',     description: 'Full-bleed image with caption overlay.' },
    { id: 'slide-10-image-box',   name: 'Image Box',      description: 'Image on top, boxed caption below.' },
    { id: 'slide-11-end-card',    name: 'End Card',       description: 'Writer bio, article URL, logo. Always last.' },
  ],
  story: [
    { id: 'story-01-cover-image',     name: 'Cover Image',     description: 'Full-bleed hero image with article title.' },
    { id: 'story-02-dark-statement',  name: 'Dark Statement',  description: 'Bold hook text on dark background.' },
    { id: 'story-03-split-image',     name: 'Split Image',     description: 'Image top half, narrative text bottom.' },
    { id: 'story-04-pull-quote',      name: 'Pull Quote',      description: 'Large centred quote, minimal design.' },
    { id: 'story-05-stat-card',       name: 'Stat Card',       description: 'Prominent stat number and label.' },
    { id: 'story-06-editorial-light', name: 'Editorial Light', description: 'Clean light background with title and teaser.' },
  ],
  linkedin: [
    { id: 'linkedin-01-bottom-anchor',   name: 'Bottom Anchor',   description: 'Image fills frame, title anchored to bottom.' },
    { id: 'linkedin-02-left-panel',      name: 'Left Panel',      description: 'Dark left column with title, image on right.' },
    { id: 'linkedin-03-center-vignette', name: 'Centre Vignette', description: 'Hero image with dark vignette, centred title.' },
    { id: 'linkedin-04-stat-overlay',    name: 'Stat Overlay',    description: 'Image with stat number overlay.' },
    { id: 'linkedin-05-quote-overlay',   name: 'Quote Overlay',   description: 'Image with styled quote box overlay.' },
  ],
};

const GROUP_CONFIG = [
  { key: 'carousel', label: 'Instagram Carousel', Icon: Instagram, iconClass: 'text-pink-500',   badgeClass: 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400' },
  { key: 'story',    label: 'Instagram Story',    Icon: Instagram, iconClass: 'text-purple-500', badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
  { key: 'linkedin', label: 'LinkedIn',           Icon: Linkedin,  iconClass: 'text-blue-600',   badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
];

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['social-settings'],
    queryFn: async () => {
      const res = await apiFetch('/api/social/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const j = await res.json();
      return j.data?.settings ?? {};
    },
  });

  const mutation = useMutation({
    mutationFn: async (disabledTemplates) => {
      const res = await apiFetch('/api/social/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabledTemplates }),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-settings'] });
      toast.success('Template settings saved');
    },
    onError: (e) => toast.error(e.message),
  });

  const disabled = new Set(settings?.disabledTemplates || []);

  function toggle(templateId) {
    const next = new Set(disabled);
    if (next.has(templateId)) {
      next.delete(templateId);
    } else {
      next.add(templateId);
    }
    mutation.mutate([...next]);
  }

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </Container>
    );
  }

  const activeCount = Object.values(TEMPLATE_REGISTRY).flat().filter((t) => !disabled.has(t.id)).length;
  const totalCount  = Object.values(TEMPLATE_REGISTRY).flat().length;

  return (
    <Container>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => router.push('/dashboard/social/settings')}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Social Settings</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">Templates</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Template Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeCount} of {totalCount} templates active. Disabled templates will not be offered to the content agent.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
            <LayoutGrid className="size-3.5" />
            {activeCount}/{totalCount} active
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-6">
        {GROUP_CONFIG.map(({ key, label, Icon, iconClass, badgeClass }) => {
          const templates = TEMPLATE_REGISTRY[key] || [];
          const groupActive = templates.filter((t) => !disabled.has(t.id)).length;
          return (
            <Card key={key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`size-7 rounded-lg flex items-center justify-center ${key === 'carousel' ? 'bg-pink-500/10' : key === 'story' ? 'bg-purple-500/10' : 'bg-blue-600/10'}`}>
                      <Icon className={`size-3.5 ${iconClass}`} />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{label}</CardTitle>
                      <CardDescription className="text-xs">{groupActive} of {templates.length} active</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {templates.map((tmpl) => {
                    const isActive = !disabled.has(tmpl.id);
                    return (
                      <div
                        key={tmpl.id}
                        className={`rounded-xl border p-3 flex items-start justify-between gap-3 transition-colors ${
                          isActive ? 'bg-card border-border' : 'bg-muted/40 border-border/50 opacity-60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-foreground">{tmpl.name}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badgeClass} border-0`}>
                              {tmpl.id.split('-')[0]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{tmpl.description}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{tmpl.id}</p>
                        </div>
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => toggle(tmpl.id)}
                          disabled={mutation.isPending}
                          aria-label={`${isActive ? 'Disable' : 'Enable'} ${tmpl.name}`}
                          className="shrink-0 mt-0.5"
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Container>
  );
}
