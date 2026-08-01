'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { VIDEO_PLATFORM_OPTIONS } from '@/lib/video-platforms';
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
  Music,
  Captions,
  Clapperboard,
  Upload,
} from 'lucide-react';

const APPROVAL_AGENT_FIELDS = [
  { key: 'approvalAgentId', label: 'Approval Agent ID' },
  { key: 'approvalEnvironmentId', label: 'Environment ID' },
];

const PLANNER_AGENT_FIELDS = [
  { key: 'plannerAgentId', label: 'Planner Agent ID' },
  { key: 'plannerEnvironmentId', label: 'Environment ID' },
];

const DIRECTOR_AGENT_FIELDS = [
  { key: 'directorAgentId', label: 'Director Agent ID' },
  { key: 'directorEnvironmentId', label: 'Environment ID' },
];

const CHARACTER_ADMIN_AGENT_FIELDS = [
  { key: 'characterAdminAgentId', label: 'Character Admin Agent ID' },
  { key: 'characterAdminEnvironmentId', label: 'Environment ID' },
];

const ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:5', '3:4', '21:9'];
const GENRES = ['auto', 'action', 'epic', 'noir', 'drama', 'horror', 'comedy'];
const PLATFORM_OPTIONS = VIDEO_PLATFORM_OPTIONS;

const TARGET_PLATFORMS = ['auto', 'instagram_reels', 'tiktok', 'youtube_shorts', 'linkedin'];
const VIDEO_STYLES = ['auto', 'explainer', 'diy', 'listicle', 'testimonial'];

export default function VideoSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPasswords, setShowPasswords] = useState(false);
  const [form, setForm] = useState({});
  const [memoryForm, setMemoryForm] = useState({});
  const [uploadingOutro, setUploadingOutro] = useState(false);
  const outroInputRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['video-settings-full'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const j = await res.json();
      return j.data ?? {};
    },
  });

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
    if (data?.memory) setMemoryForm(data.memory);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, sessionRotateAfter: memoryForm.sessionRotateAfter };
      const res = await apiFetch('/api/video/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-settings-full'] });
      toast.success('Settings saved');
    },
    onError: (e) => toast.error(e.message),
  });

  const saveOutroUrlMutation = useMutation({
    mutationFn: async (outroVideoUrl) => {
      const res = await apiFetch('/api/video/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outroVideoUrl }),
      });
      if (!res.ok) throw new Error('Failed to save outro clip');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video-settings-full'] }),
    onError: (e) => toast.error(e.message),
  });

  async function handleOutroUpload(file) {
    if (!file) return;
    setUploadingOutro(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('directory', 'video-outro');
      const res = await apiFetch('/api/uploads', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to upload outro clip');
      }
      const { data: uploaded } = await res.json();
      setField('outroVideoUrl', uploaded.url);
      await saveOutroUrlMutation.mutateAsync(uploaded.url);
      toast.success('Outro clip uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingOutro(false);
      if (outroInputRef.current) outroInputRef.current.value = '';
    }
  }

  const { data: captionTemplates = [] } = useQuery({
    queryKey: ['captions-templates'],
    queryFn: async () => {
      const res = await apiFetch('/api/video/captions/templates');
      if (!res.ok) return [];
      const j = await res.json();
      return Array.isArray(j.data) ? j.data : (j.data?.templates ?? []);
    },
    retry: false,
  });

  const resetSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/video/settings', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to reset session');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-settings-full'] });
      toast.success('AI session reset. Next campaign will start a fresh session.');
    },
    onError: (e) => toast.error(e.message),
  });

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function togglePlatform(key) {
    setForm((prev) => {
      const current = prev.defaultPlatforms || [];
      const next = current.includes(key) ? current.filter((p) => p !== key) : [...current, key];
      return { ...prev, defaultPlatforms: next };
    });
  }

  if (isLoading) {
    return (
      <Container>
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      </Container>
    );
  }

  const memory = data?.memory;

  return (
    <Container>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/video')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Video Settings</h1>
          <p className="text-sm text-muted-foreground">Configure the two Managed Agents and pipeline defaults.</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
          Save
        </Button>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Review Mode</CardTitle>
            <CardDescription className="text-xs">
              When disabled, videos are automatically scheduled via Buffer immediately after upload.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="requireReview">Require manual review before scheduling</Label>
              <Switch id="requireReview" checked={form.requireReview ?? true} onCheckedChange={(v) => setField('requireReview', v)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Publishing Channels</CardTitle>
            <CardDescription className="text-xs">
              Every video schedules the SAME clip to all selected channels (fan-out), reusing the
              Buffer channel IDs already configured in Social → Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map(({ key, label }) => {
              const active = (form.defaultPlatforms || []).includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePlatform(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Production Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Max videos / cycle</Label>
              <Input type="number" min={1} value={form.defaultMaxVideosPerCampaign ?? 5} onChange={(e) => setField('defaultMaxVideosPerCampaign', Number(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Duration (seconds)</Label>
              <Input type="number" min={4} max={15} value={form.defaultDuration ?? 15} onChange={(e) => setField('defaultDuration', Number(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Aspect ratio</Label>
              <Select value={form.defaultAspectRatio ?? '9:16'} onValueChange={(v) => setField('defaultAspectRatio', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Genre</Label>
              <Select value={form.defaultGenre ?? 'auto'} onValueChange={(v) => setField('defaultGenre', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Max generations / video</Label>
              <Input type="number" min={1} max={10} value={form.maxGenerationsPerPost ?? 4} onChange={(e) => setField('maxGenerationsPerPost', Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Plan → Approve → Execute Defaults</CardTitle>
            <CardDescription className="text-xs">
              Cycle-level defaults for the director agent&apos;s Phase 1 plan — each is still overridable per
              campaign or per post.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Target platform</Label>
              <Select value={form.defaultTargetPlatform ?? 'auto'} onValueChange={(v) => setField('defaultTargetPlatform', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Video style</Label>
              <Select value={form.defaultVideoStyle ?? 'auto'} onValueChange={(v) => setField('defaultVideoStyle', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIDEO_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Target shot count</Label>
              <Input
                type="number"
                min={1}
                max={12}
                placeholder="auto"
                value={form.defaultTargetShotCount ?? ''}
                onChange={(e) => setField('defaultTargetShotCount', e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Orientation</Label>
              <Select value={form.defaultOrientation ?? '9:16'} onValueChange={(v) => setField('defaultOrientation', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clapperboard className="size-4" />
              Branded Outro
            </CardTitle>
            <CardDescription className="text-xs">
              A fixed clip appended to the end of every assembled video, before background music is
              generated — so the music track is generated to cover the outro too instead of cutting off
              when it starts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="outroEnabled">Enable outro</Label>
              <Switch id="outroEnabled" checked={form.outroEnabled ?? true} onCheckedChange={(v) => setField('outroEnabled', v)} />
            </div>

            {form.outroVideoUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={form.outroVideoUrl} controls className="w-full max-w-[180px] mx-auto rounded-lg bg-black border" />
            ) : (
              <p className="text-xs text-muted-foreground border border-dashed rounded-md p-2.5">No outro clip uploaded yet.</p>
            )}

            <Button type="button" size="sm" variant="outline" onClick={() => outroInputRef.current?.click()} disabled={uploadingOutro}>
              {uploadingOutro ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
              {form.outroVideoUrl ? 'Replace clip' : 'Upload clip'}
            </Button>
            <input
              ref={outroInputRef}
              type="file"
              accept="video/mp4,video/quicktime"
              className="hidden"
              onChange={(e) => handleOutroUpload(e.target.files?.[0])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Music className="size-4" />
              Background Music (ElevenLabs)
            </CardTitle>
            <CardDescription className="text-xs">
              A duration-matched instrumental track is generated per assembly pass and mixed under the narration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="musicEnabled">Enable background music</Label>
              <Switch id="musicEnabled" checked={form.musicEnabled ?? true} onCheckedChange={(v) => setField('musicEnabled', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Default volume</Label>
              <Input
                type="number" min={0} max={1} step={0.05}
                value={form.musicVolume ?? 0.3}
                onChange={(e) => setField('musicVolume', Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Captions className="size-4" />
              Captions (Captions.ai)
            </CardTitle>
            <CardDescription className="text-xs">
              Animated word-by-word captions burned in after assembly. Requires 9:16 orientation and a video under 50MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="captionsEnabled">Enable captions</Label>
              <Switch id="captionsEnabled" checked={form.captionsEnabled ?? true} onCheckedChange={(v) => setField('captionsEnabled', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Template</Label>
              {captionTemplates.length > 0 ? (
                <Select value={form.captionsTemplateId ?? ''} onValueChange={(v) => {
                  setField('captionsTemplateId', v);
                  const t = captionTemplates.find((tpl) => tpl.id === v);
                  if (t?.name) setField('captionsTemplateName', t.name);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {captionTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.captionsTemplateId || ''}
                  onChange={(e) => setField('captionsTemplateId', e.target.value)}
                  placeholder="ctpl_xxxxxxxx (Aries recommended)"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="size-4" />
              Anthropic Managed Agents
            </CardTitle>
            <CardDescription className="text-xs">
              Create all four agents in the Anthropic Console (see <code>video-approval-agent.yaml</code>,{' '}
              <code>video-director-plan-agent.yaml</code>, <code>video-director-agent.yaml</code>, and{' '}
              <code>video-character-admin-agent.yaml</code> at the project root) and paste their IDs here. The{' '}
              <strong>Approval Agent</strong> runs once per campaign; the <strong>Planner Agent</strong> drafts
              and revises the narration/segments/wardrobe in text only — it has no Higgsfield tools at all, so
              planning can never spend a real generation credit; the <strong>Director Agent</strong> opens a
              fresh session per approved plan and directs the Higgsfield shoot itself via Higgsfield&apos;s
              hosted MCP server; the <strong>Character Admin Agent</strong> is an admin-only, one-off session
              that creates a Higgsfield Reference Element per section (Video → Characters). The Director and
              Character Admin agents both need the <strong>Higgsfield Vault ID</strong> below to authenticate
              MCP calls — the Planner Agent does not.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPasswords(!showPasswords)}>
                {showPasswords ? <EyeOff className="size-3.5 mr-1" /> : <Eye className="size-3.5 mr-1" />}
                {showPasswords ? 'Hide' : 'Show'} IDs
              </Button>
            </div>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approval Agent</p>
            {APPROVAL_AGENT_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{label}</Label>
                <Input type={showPasswords ? 'text' : 'password'} value={form[key] || ''} onChange={(e) => setField(key, e.target.value)} placeholder="ant_xxxxxxxx" />
              </div>
            ))}

            <Separator />

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Planner Agent</p>
            {PLANNER_AGENT_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{label}</Label>
                <Input type={showPasswords ? 'text' : 'password'} value={form[key] || ''} onChange={(e) => setField(key, e.target.value)} placeholder="ant_xxxxxxxx" />
              </div>
            ))}

            <Separator />

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Director Agent</p>
            {DIRECTOR_AGENT_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{label}</Label>
                <Input type={showPasswords ? 'text' : 'password'} value={form[key] || ''} onChange={(e) => setField(key, e.target.value)} placeholder="ant_xxxxxxxx" />
              </div>
            ))}

            <Separator />

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Character Admin Agent</p>
            {CHARACTER_ADMIN_AGENT_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{label}</Label>
                <Input type={showPasswords ? 'text' : 'password'} value={form[key] || ''} onChange={(e) => setField(key, e.target.value)} placeholder="ant_xxxxxxxx" />
              </div>
            ))}

            <Separator />

            <div className="grid grid-cols-2 gap-3 items-center">
              <Label>Higgsfield Vault ID</Label>
              <Input type={showPasswords ? 'text' : 'password'} value={form.higgsfieldVaultId || ''} onChange={(e) => setField('higgsfieldVaultId', e.target.value)} placeholder="vlt_xxxxxxxx" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="size-4" />
              AI Session Memory
            </CardTitle>
            <CardDescription className="text-xs">
              The approval agent maintains editorial memory within a session. After N campaigns, it writes a
              handoff summary and starts a fresh session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Active session</p>
                {memory?.activeSessionId ? (
                  <p className="text-xs text-muted-foreground font-mono">{memory.activeSessionId}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">None — new session on next run</p>
                )}
              </div>
              {memory?.activeSessionId ? (
                <Badge variant="default" className="text-xs"><CheckCircle2 className="size-3 mr-1" />Active</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs"><AlertCircle className="size-3 mr-1" />Inactive</Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Campaigns in session</p>
              <p className="text-xs font-medium">{memory?.sessionCampaignCount ?? 0} / {memory?.sessionRotateAfter ?? 10}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <Label className="text-xs">Rotate after N campaigns</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={memoryForm.sessionRotateAfter ?? 10}
                onChange={(e) => setMemoryForm((prev) => ({ ...prev, sessionRotateAfter: Number(e.target.value) }))}
              />
            </div>

            {memory?.handoffSummary && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Handoff summary</p>
                <div className="text-xs text-muted-foreground bg-muted rounded p-2 max-h-24 overflow-y-auto">{memory.handoffSummary}</div>
              </div>
            )}

            <Separator />

            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm('This will clear the active session and all handoff context. Continue?')) {
                  resetSessionMutation.mutate();
                }
              }}
              disabled={resetSessionMutation.isPending}
            >
              {resetSessionMutation.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <RotateCw className="size-3.5 mr-1.5" />}
              Force Rotate Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
