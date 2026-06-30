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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import {
  ArrowLeft,
  Loader2,
  Save,
  RotateCw,
  Brain,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Settings fields config
// ---------------------------------------------------------------------------
const BUFFER_FIELDS = [
  { key: 'instagramCarouselProfileId', label: 'Instagram Carousel Profile ID' },
  { key: 'instagramStoryProfileId', label: 'Instagram Story Profile ID' },
  { key: 'linkedinProfileId', label: 'LinkedIn Profile ID' },
  { key: 'twitterProfileId', label: 'Twitter Profile ID' },
];

const AGENT_FIELDS = [
  { key: 'approvalAgentId', label: 'Approval Agent ID' },
  { key: 'approvalEnvironmentId', label: 'Environment ID' },
];

const DEFAULTS_FIELDS = [
  { key: 'defaultMaxInstagramCarousel', label: 'Max IG Carousels / week' },
  { key: 'defaultMaxInstagramStory', label: 'Max IG Stories / week' },
  { key: 'defaultMaxLinkedin', label: 'Max LinkedIn / week' },
  { key: 'defaultMaxTwitter', label: 'Max Twitter / week' },
];

const TIME_FIELDS = [
  { key: 'instagramPostTime', label: 'Instagram post time (HH:MM)' },
  { key: 'linkedinPostTime', label: 'LinkedIn post time (HH:MM)' },
  { key: 'twitterPostTime', label: 'Twitter post time (HH:MM)' },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SocialSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPasswords, setShowPasswords] = useState(false);
  const [form, setForm] = useState({});
  const [memoryForm, setMemoryForm] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['social-settings'],
    queryFn: async () => {
      const res = await apiFetch('/api/social/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const j = await res.json();
      return j.data ?? {};
    },
  });

  useEffect(() => {
    if (data?.settings) {
      setForm(data.settings);
    }
    if (data?.memory) {
      setMemoryForm(data.memory);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        sessionRotateAfter: memoryForm.sessionRotateAfter,
      };
      const res = await apiFetch('/api/social/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-settings'] });
      toast.success('Settings saved');
    },
    onError: (e) => toast.error(e.message),
  });

  const resetSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/social/settings', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to reset session');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-settings'] });
      toast.success('AI session reset. Next campaign will start a fresh session.');
    },
    onError: (e) => toast.error(e.message),
  });

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (isLoading) {
    return (
      <Container>
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </Container>
    );
  }

  const memory = data?.memory;

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/social')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Social Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure Buffer, Anthropic Agent, and pipeline defaults.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="size-4 mr-1.5" />
          )}
          Save
        </Button>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Review toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Review Mode</CardTitle>
            <CardDescription className="text-xs">
              When disabled, posts are automatically scheduled via Buffer immediately after export.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="requireReview">Require manual review before scheduling</Label>
              <Switch
                id="requireReview"
                checked={form.requireReview ?? true}
                onCheckedChange={(v) => setField('requireReview', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Buffer profile IDs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Buffer Profile IDs</CardTitle>
            <CardDescription className="text-xs">
              Profile IDs from your Buffer account for each platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {BUFFER_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{label}</Label>
                <Input
                  value={form[key] || ''}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder="buf_xxxxxxxx"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Default Post Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DEFAULTS_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{label}</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={form[key] ?? ''}
                  onChange={(e) => setField(key, Number(e.target.value))}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Post times */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preferred Post Times</CardTitle>
            <CardDescription className="text-xs">
              Local time for scheduling via Buffer (HH:MM format).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {TIME_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{label}</Label>
                <Input
                  value={form[key] || ''}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder="09:00"
                  maxLength={5}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Anthropic Managed Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="size-4" />
              Anthropic Managed Agent
            </CardTitle>
            <CardDescription className="text-xs">
              Create the agent manually in the Anthropic Console, then paste the IDs here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPasswords(!showPasswords)}
              >
                {showPasswords ? (
                  <EyeOff className="size-3.5 mr-1" />
                ) : (
                  <Eye className="size-3.5 mr-1" />
                )}
                {showPasswords ? 'Hide' : 'Show'} IDs
              </Button>
            </div>
            {AGENT_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{label}</Label>
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={form[key] || ''}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder="ant_xxxxxxxx"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Memory / Session Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="size-4" />
              AI Session Memory
            </CardTitle>
            <CardDescription className="text-xs">
              The approval agent maintains editorial memory within a session. After N campaigns, it
              writes a handoff summary and starts a fresh session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Session status */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Active session</p>
                {memory?.activeSessionId ? (
                  <p className="text-xs text-muted-foreground font-mono">
                    {memory.activeSessionId}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">None — new session on next run</p>
                )}
              </div>
              {memory?.activeSessionId ? (
                <Badge variant="default" className="text-xs">
                  <CheckCircle2 className="size-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  <AlertCircle className="size-3 mr-1" />
                  Inactive
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Campaigns in session</p>
              <p className="text-xs font-medium">
                {memory?.sessionCampaignCount ?? 0} / {memory?.sessionRotateAfter ?? 10}
              </p>
            </div>

            {/* Rotate after slider */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label className="text-xs">Rotate after N campaigns</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={memoryForm.sessionRotateAfter ?? 10}
                onChange={(e) =>
                  setMemoryForm((prev) => ({
                    ...prev,
                    sessionRotateAfter: Number(e.target.value),
                  }))
                }
              />
            </div>

            {/* Handoff summary preview */}
            {memory?.handoffSummary && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Handoff summary</p>
                <div className="text-xs text-muted-foreground bg-muted rounded p-2 max-h-24 overflow-y-auto">
                  {memory.handoffSummary}
                </div>
              </div>
            )}

            <Separator />

            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    'This will clear the active session and all handoff context. The next campaign will start a completely fresh session. Continue?',
                  )
                ) {
                  resetSessionMutation.mutate();
                }
              }}
              disabled={resetSessionMutation.isPending}
            >
              {resetSessionMutation.isPending ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <RotateCw className="size-3.5 mr-1.5" />
              )}
              Force Rotate Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
