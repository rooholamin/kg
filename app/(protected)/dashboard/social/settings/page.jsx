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

const APPROVAL_AGENT_FIELDS = [
  { key: 'approvalAgentId', label: 'Approval Agent ID' },
  { key: 'approvalEnvironmentId', label: 'Environment ID' },
];

const CONTENT_AGENT_FIELDS = [
  { key: 'contentAgentId', label: 'Content Agent ID' },
  { key: 'contentEnvironmentId', label: 'Content Environment ID' },
];

const DEFAULTS_FIELDS = [
  { key: 'defaultMaxInstagramCarousel', label: 'Max IG Carousels / week' },
  { key: 'defaultMaxInstagramStory', label: 'Max IG Stories / week' },
  { key: 'defaultMaxLinkedin', label: 'Max LinkedIn / week' },
  { key: 'defaultMaxTwitter', label: 'Max Twitter / week' },
];

const PLATFORM_WINDOW_CONFIG = [
  {
    label: 'Instagram Carousel',
    daysKey: 'instagramCarouselDays',
    startKey: 'instagramCarouselWindowStart',
    endKey: 'instagramCarouselWindowEnd',
  },
  {
    label: 'Instagram Story',
    daysKey: 'instagramStoryDays',
    startKey: 'instagramStoryWindowStart',
    endKey: 'instagramStoryWindowEnd',
  },
  {
    label: 'LinkedIn',
    daysKey: 'linkedinDays',
    startKey: 'linkedinWindowStart',
    endKey: 'linkedinWindowEnd',
  },
  {
    label: 'Twitter / X',
    daysKey: 'twitterDays',
    startKey: 'twitterWindowStart',
    endKey: 'twitterWindowEnd',
  },
];

const DAY_OPTIONS = [
  { label: 'Sun', bit: 1 },
  { label: 'Mon', bit: 2 },
  { label: 'Tue', bit: 4 },
  { label: 'Wed', bit: 8 },
  { label: 'Thu', bit: 16 },
  { label: 'Fri', bit: 32 },
  { label: 'Sat', bit: 64 },
];

// ---------------------------------------------------------------------------
// DayMaskPicker
// ---------------------------------------------------------------------------
function DayMaskPicker({ value, onChange }) {
  const mask = value || 0;
  return (
    <div className="flex gap-1 flex-wrap">
      {DAY_OPTIONS.map(({ label, bit }) => {
        const active = Boolean(mask & bit);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(active ? mask & ~bit : mask | bit)}
            className={`px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

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

        {/* Posting Windows */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Posting Windows</CardTitle>
            <CardDescription className="text-xs">
              Active days and time window per platform. Multiple posts are spread evenly across the
              window. When Start = End, all posts land at the same time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {PLATFORM_WINDOW_CONFIG.map(({ label, daysKey, startKey, endKey }) => (
              <div key={daysKey} className="space-y-2">
                <p className="text-xs font-medium">{label}</p>
                <DayMaskPicker
                  value={form[daysKey] ?? 0}
                  onChange={(v) => setForm((f) => ({ ...f, [daysKey]: v }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Window Start</Label>
                    <Input
                      type="time"
                      value={form[startKey] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [startKey]: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Window End</Label>
                    <Input
                      type="time"
                      value={form[endKey] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [endKey]: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Anthropic Managed Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="size-4" />
              Anthropic Managed Agents
            </CardTitle>
            <CardDescription className="text-xs">
              Create both agents in the Anthropic Console and paste their IDs here. The{' '}
              <strong>Approval Agent</strong> runs once per campaign and maintains editorial memory
              across sessions. The <strong>Content Agent</strong> runs per post and opens one
              persistent session per post for edits and regenerations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Approval Agent
              </p>
            </div>
            {APPROVAL_AGENT_FIELDS.map(({ key, label }) => (
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

            <Separator />

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Content Agent
              </p>
              <p className="text-xs text-muted-foreground">
                One session is created per post and reused on every regeneration or edit.
              </p>
            </div>
            {CONTENT_AGENT_FIELDS.map(({ key, label }) => (
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
