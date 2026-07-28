'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';
import { ArrowLeft, Loader2, Save, MapPin } from 'lucide-react';

export default function VideoEnvironmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: 'KG Media Loft', textDescriptor: '', refImageUrl: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['video-environment'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/environment');
      if (!res.ok) throw new Error('Failed to load environment');
      const j = await res.json();
      return j.data ?? {};
    },
  });

  useEffect(() => {
    if (data) setForm({ name: data.name || 'KG Media Loft', textDescriptor: data.textDescriptor || '', refImageUrl: data.refImageUrl || '' });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/video/environment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['video-environment'] }); toast.success('Environment saved'); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <Container><div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div></Container>;
  }

  return (
    <Container>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/video')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Video Environment</h1>
          <p className="text-sm text-muted-foreground">
            The one shared studio every KG Hub video is shot &quot;in&quot; — described as text, not an image
            reference, to avoid the environment&apos;s composition bleeding into generated frames.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
          Save
        </Button>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><MapPin className="size-4" />Environment</CardTitle>
            <CardDescription className="text-xs">
              Cover architecture/geography, surface texture, scale, atmosphere, light source, colour palette,
              and mood — the same 7-point structure used for environment descriptors in the Higgsfield playbook.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Text descriptor</Label>
              <Textarea
                rows={8}
                value={form.textDescriptor}
                onChange={(e) => setForm((f) => ({ ...f, textDescriptor: e.target.value }))}
                placeholder="e.g. Sculpted concrete walls with rough board-form texture, rising in narrow parallel columns. Polished cast-stone floor reflecting cold ambient light. Scale is intimate but ceiling is high — light falls from a single skylight overhead. Air is still and clear, no haze. Colours are neutral grey-cream with a single warm reflection where late sun catches the floor. Reads as quiet, considered, almost reverent."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reference image URL (optional — view-only, never passed to the director agent as a ref)</Label>
              <Input value={form.refImageUrl} onChange={(e) => setForm((f) => ({ ...f, refImageUrl: e.target.value }))} placeholder="https://…" />
            </div>
            {form.refImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.refImageUrl} alt="KG Media Loft reference" className="w-full rounded-lg border" />
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
