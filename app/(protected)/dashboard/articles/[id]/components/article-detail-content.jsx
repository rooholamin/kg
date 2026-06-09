'use client';

import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { ReadinessBadge } from '@/components/custom/readiness-badge';
import { PipelineStageBadge } from '@/components/custom/pipeline-stage-badge';
import { PIPELINE_STAGES } from '@/app/(protected)/dashboard/_mock';
import { ContentRenderer } from '@/components/custom/content-renderer';
import { cn, toYoutubeEmbedUrl } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import {
  History,
  Star,
  FlaskConical,
  PenLine,
  ImageIcon,
  ImagePlus,
  CheckCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  BookOpen,
  Lightbulb,
  Sparkles,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Sync featured image button (FIFU second-save workaround)
// ---------------------------------------------------------------------------

function SyncImageButton({ articleId }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/articles/${articleId}/wordpress/sync-image`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to sync image');
      }
    },
    onSuccess: () => toast.success('Featured image synced to WordPress.'),
    onError: (err) => toast.error(err.message),
  });

  return (
    <Button
      size="xs"
      variant="outline"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="text-xs h-6 px-2"
    >
      {mutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <ImageIcon className="size-3 me-1" />}
      Sync image
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Pipeline progress bar
// ---------------------------------------------------------------------------

function PipelineProgress({ stages, currentStage }) {
  const currentIndex = stages.findIndex((s) => s.id === currentStage);
  return (
    <div className="w-full">
      <div
        className="overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] pb-0.5"
        aria-label="Article pipeline progress"
      >
        <div className="mx-auto w-max min-w-full max-w-6xl px-0.5 sm:w-full sm:px-0">
          <div
            className="grid w-full min-w-[40rem] gap-0"
            style={{
              gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`,
            }}
            role="list"
          >
            {stages.map((stage, index) => {
              const isDone = currentIndex >= 0 && index < currentIndex;
              const isCurrent = currentIndex >= 0 && index === currentIndex;
              const isUpcoming = !isDone && !isCurrent;
              const rightLineDone =
                currentIndex >= 0 && index < stages.length - 1
                  ? index < currentIndex
                  : false;
              const leftLineDone =
                currentIndex >= 0 && index > 0
                  ? (index - 1) < currentIndex
                  : false;
              return (
                <div key={stage.id} className="relative min-w-0" role="listitem">
                  <div className="relative flex h-7 w-full min-w-0 items-center justify-center">
                    {index > 0 && (
                      <div
                        className={cn(
                          'absolute top-1/2 z-0 h-0.5 -translate-y-1/2 rounded-full',
                          'left-0 right-[calc(50%+0.875rem)]',
                          leftLineDone ? 'bg-primary' : 'bg-muted-foreground/20',
                        )}
                        aria-hidden
                      />
                    )}
                    {index < stages.length - 1 && (
                      <div
                        className={cn(
                          'absolute top-1/2 z-0 h-0.5 -translate-y-1/2 rounded-full',
                          'right-0 left-[calc(50%+0.875rem)]',
                          rightLineDone ? 'bg-primary' : 'bg-muted-foreground/20',
                        )}
                        aria-hidden
                      />
                    )}
                    <div
                      className={cn(
                        'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-sm',
                        isDone && 'border-primary bg-primary text-primary-foreground',
                        isCurrent &&
                          'border-primary bg-primary text-primary-foreground ring-4 ring-primary/25',
                        isUpcoming &&
                          'border-muted-foreground/35 bg-background text-muted-foreground',
                      )}
                      title={stage.label}
                    >
                      {isDone ? (
                        <svg className="size-3.5" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <path
                            d="M2 7l4 4 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        stage.order
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 min-w-0 px-0.5">
                    <span
                      className={cn(
                        'line-clamp-2 w-full min-h-10 text-balance',
                        'text-center text-[10px] font-medium leading-snug',
                        isCurrent && 'text-primary',
                        isDone && 'text-primary/90',
                        isUpcoming && 'text-muted-foreground',
                      )}
                      title={stage.label}
                    >
                      {stage.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline editable primitive
// ---------------------------------------------------------------------------

function InlineEditable({ value, onSave, multiline = false, className, placeholder = 'Empty' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      if (inputRef.current?.setSelectionRange) {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [editing]);

  function start() {
    setDraft(value ?? '');
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (value ?? '').trim()) onSave(trimmed);
  }

  function handleKey(e) {
    if (e.key === 'Escape') { setEditing(false); setDraft(value ?? ''); }
    if (!multiline && e.key === 'Enter') { e.preventDefault(); commit(); }
    if (multiline && e.key === 'Enter' && e.metaKey) { e.preventDefault(); commit(); }
  }

  const sharedCls = cn(
    'w-full rounded-sm border border-violet-400 bg-background px-1.5 py-1',
    'text-sm outline-none ring-2 ring-violet-300/50 focus:ring-violet-400/70',
    className,
  );

  if (editing) {
    return multiline ? (
      <textarea
        ref={inputRef}
        value={draft}
        rows={Math.max(3, (draft.match(/\n/g) ?? []).length + 2)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        className={cn(sharedCls, 'resize-y leading-relaxed')}
      />
    ) : (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        className={sharedCls}
      />
    );
  }

  return (
    <span
      onDoubleClick={start}
      title="Double-click to edit"
      className={cn(
        'group/edit cursor-text rounded-sm px-0.5 -mx-0.5 transition-colors',
        'hover:bg-violet-50 dark:hover:bg-violet-950/30',
        !value && 'text-muted-foreground italic',
        className,
      )}
    >
      {value || placeholder}
      <span className="ml-1.5 hidden text-[9px] font-medium text-violet-400 group-hover/edit:inline">
        dbl-click
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Automation control panel
// ---------------------------------------------------------------------------

const RUN_STATUS_CFG = {
  running: {
    label: 'Running',
    icon: Loader2,
    cls: 'text-violet-600 dark:text-violet-400',
    spin: true,
  },
  completed: {
    label: 'Done',
    icon: CheckCircle2,
    cls: 'text-emerald-600 dark:text-emerald-400',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    cls: 'text-rose-600 dark:text-rose-400',
  },
};

const ASSET_STATUS_CFG = {
  pending: { label: 'Pending', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  generating: { label: 'Generating', cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-300', pulse: true },
  completed: { label: 'Done', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  failed: { label: 'Failed', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
};

function AutomationPanel({
  researchMutation,
  researchDone,
  isResearching,
  writingMutation,
  writingDone,
  isWriting,
  assetsMutation,
  assetsDone,
  hasResearch,
  assetRequests,
  articleId,
  onActionDone,
}) {
  const approve = useMutation({
    mutationFn: () =>
      apiFetch(`/api/articles/${articleId}/automation/approve`, { method: 'POST' }).then(
        (r) => r.json(),
      ),
    onSuccess: (data) => {
      if (data?.ok === false || data?.message) {
        toast.error(data.message || 'Approval failed');
      } else {
        toast.success('Sent to approval');
        onActionDone?.();
      }
    },
    onError: () => toast.error('Approval failed — check console'),
  });

  const doneBtn = 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600';

  return (
    <div className="mb-5 rounded-xl border border-border/80 bg-muted/20 p-3 shadow-sm ring-1 ring-border/30 sm:p-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-foreground/70">
        Automation
      </p>
      <div className="flex flex-wrap gap-2">
        {/* Research */}
        <Button
          size="sm"
          variant={researchDone ? 'default' : 'outline'}
          disabled={isResearching}
          onClick={() => researchMutation.mutate()}
          className={cn('gap-1.5 transition-all', researchDone && doneBtn)}
        >
          {isResearching ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> :
           researchDone ? <CheckCircle2 className="size-3.5" aria-hidden /> :
           <FlaskConical className="size-3.5" aria-hidden />}
          {researchDone ? 'Research Done' : 'Run Research'}
        </Button>

        {/* Writing */}
        <Button
          size="sm"
          variant={writingDone ? 'default' : 'outline'}
          disabled={isWriting || !hasResearch}
          onClick={() => writingMutation.mutate()}
          title={!hasResearch ? 'Complete research first' : undefined}
          className={cn('gap-1.5 transition-all', writingDone && doneBtn)}
        >
          {isWriting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> :
           writingDone ? <CheckCircle2 className="size-3.5" aria-hidden /> :
           <PenLine className="size-3.5" aria-hidden />}
          {writingDone ? 'Writing Done' : 'Run Writing'}
        </Button>

        {/* Assets */}
        <Button
          size="sm"
          variant="outline"
          disabled={assetsMutation.isPending || !assetRequests?.length}
          onClick={() => assetsMutation.mutate()}
          title={!assetRequests?.length ? 'Run writing first to generate asset requests' : undefined}
          variant={assetsDone ? 'default' : 'outline'}
          className={cn('gap-1.5 transition-all', assetsDone && doneBtn)}
        >
          {assetsMutation.isPending
            ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
            : assetsDone
              ? <CheckCircle2 className="size-3.5" aria-hidden />
              : <ImageIcon className="size-3.5" aria-hidden />}
          {assetsDone ? 'Assets Done' : 'Generate Assets'}
        </Button>

        {/* Approve */}
        <Button
          size="sm"
          variant="default"
          disabled={approve.isPending}
          onClick={() => approve.mutate()}
          className="gap-1.5"
        >
          {approve.isPending
            ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
            : <CheckCheck className="size-3.5" aria-hidden />}
          Send to Approval
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typewriter hook
// ---------------------------------------------------------------------------

/**
 * Typewriter hook.
 * animate=false → display text immediately, no effect.
 * animate=true  → type from empty regardless of mount state.
 */
function useTypewriter(text, animate = false, msPerChar = 5) {
  const [displayed, setDisplayed] = useState(animate ? '' : (text ?? ''));
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!animate || !text) {
      setDisplayed(text ?? '');
      setRunning(false);
      return;
    }
    setRunning(true);
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setRunning(false); }
    }, msPerChar);
    return () => clearInterval(id);
  }, [animate, text, msPerChar]);

  return { displayed, animating: running };
}

// ---------------------------------------------------------------------------
// Research loading state
// ---------------------------------------------------------------------------

const RESEARCH_STEPS = [
  { Icon: Search, text: 'Searching the web…' },
  { Icon: BookOpen, text: 'Reading sources…' },
  { Icon: Lightbulb, text: 'Identifying key facts…' },
  { Icon: FlaskConical, text: 'Synthesising findings…' },
  { Icon: Sparkles, text: 'Compiling research notes…' },
];

const WRITING_STEPS = [
  { Icon: PenLine, text: 'Drafting introduction…' },
  { Icon: Sparkles, text: 'Writing sections…' },
  { Icon: BookOpen, text: 'Adding supporting details…' },
  { Icon: Lightbulb, text: 'Crafting conclusion…' },
  { Icon: CheckCircle2, text: 'Finalising content…' },
];

const ASSET_STEPS = [
  { Icon: Sparkles,     text: 'Imagining the scene…' },
  { Icon: ImageIcon,    text: 'Painting the details…' },
  { Icon: Lightbulb,   text: 'Composing the shot…' },
  { Icon: CheckCircle2, text: 'Saving the artwork…' },
];

function CellPaintingLoader() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % ASSET_STEPS.length), 2500);
    return () => clearInterval(id);
  }, []);
  const { Icon, text } = ASSET_STEPS[step];

  return (
    <div className="flex flex-col items-center justify-center gap-3 w-full h-full px-4 py-5 text-center">
      <div className="relative flex items-center justify-center">
        <span className="absolute size-14 rounded-full bg-amber-500/15 animate-ping" />
        <span className="absolute size-10 rounded-full bg-amber-500/20 animate-pulse" />
        <div className="relative flex size-9 items-center justify-center rounded-full bg-amber-600/90 text-white shadow-lg">
          <Icon className="size-4" />
        </div>
      </div>

      <div key={step} className="animate-in fade-in slide-in-from-bottom-1 duration-400">
        <p className="text-xs font-medium text-foreground">{text}</p>
      </div>

      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-amber-500/60"
            style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

function ResearchThinking() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % RESEARCH_STEPS.length), 2800);
    return () => clearInterval(id);
  }, []);

  const current = RESEARCH_STEPS[step % RESEARCH_STEPS.length];
  const Icon = current.Icon;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5 text-center">
        {/* pulsing ring */}
        <div className="relative flex items-center justify-center">
          <span className="absolute size-16 rounded-full bg-violet-500/15 animate-ping" />
          <span className="absolute size-12 rounded-full bg-violet-500/20 animate-pulse" />
          <div className="relative flex size-10 items-center justify-center rounded-full bg-violet-600/90 text-white shadow-lg">
            <Icon className="size-5" />
          </div>
        </div>

        {/* cycling step label */}
        <div key={step} className="animate-in fade-in slide-in-from-bottom-1 duration-400">
          <p className="text-sm font-medium text-foreground">{current.text}</p>
        </div>

        {/* animated dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-violet-500/60"
              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground max-w-xs">
          The AI agent is researching your topic. This can take up to a minute — sit tight.
        </p>
      </CardContent>
    </Card>
  );
}

function WritingLoader() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % WRITING_STEPS.length), 3000);
    return () => clearInterval(id);
  }, []);
  const current = WRITING_STEPS[step];
  const Icon = current.Icon;
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5 text-center">
        <div className="relative flex items-center justify-center">
          <span className="absolute size-16 rounded-full bg-blue-500/15 animate-ping" />
          <span className="absolute size-12 rounded-full bg-blue-500/20 animate-pulse" />
          <div className="relative flex size-10 items-center justify-center rounded-full bg-blue-600/90 text-white shadow-lg">
            <Icon className="size-5" />
          </div>
        </div>
        <div key={step} className="animate-in fade-in slide-in-from-bottom-1 duration-400">
          <p className="text-sm font-medium text-foreground">{current.text}</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-blue-500/60"
              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">
          The AI agent is writing your article. This can take a couple of minutes.
        </p>
      </CardContent>
    </Card>
  );
}

function AssetLoader({ total = 0, done = 0 }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % ASSET_STEPS.length), 2500);
    return () => clearInterval(id);
  }, []);
  const current = ASSET_STEPS[step];
  const Icon = current.Icon;
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-8 pb-8 flex flex-col items-center gap-5 text-center">
        <div className="relative flex items-center justify-center">
          <span className="absolute size-16 rounded-full bg-amber-500/15 animate-ping" />
          <span className="absolute size-12 rounded-full bg-amber-500/20 animate-pulse" />
          <div className="relative flex size-10 items-center justify-center rounded-full bg-amber-600/90 text-white shadow-lg">
            <Icon className="size-5" />
          </div>
        </div>
        <div key={step} className="animate-in fade-in slide-in-from-bottom-1 duration-400">
          <p className="text-sm font-medium text-foreground">{current.text}</p>
          {total > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {done} of {total} asset{total !== 1 ? 's' : ''} done
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-amber-500/60"
              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">
          Generating and uploading images one by one. This may take a few minutes.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Research tab
// ---------------------------------------------------------------------------

function RedoResearchDialog({ open, onOpenChange, onConfirm }) {
  const [angle, setAngle] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) {
      setAngle('');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  function handleConfirm() {
    onConfirm(angle.trim());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redo Research</DialogTitle>
          <DialogDescription>
            Optionally give the agent a new direction or focus for this research run. Leave blank
            to re-run with the same parameters.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-1 space-y-1.5">
          <label className="text-sm font-medium">Research angle / comment</label>
          <Textarea
            ref={textareaRef}
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="e.g. Focus on recent 2025–2026 studies, avoid general overviews, emphasise practical applications…"
            rows={4}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) handleConfirm();
              if (e.key === 'Escape') onOpenChange(false);
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            This comment is sent to the AI as the article angle. ⌘↵ to confirm.
          </p>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="gap-1.5">
            <FlaskConical className="size-3.5" aria-hidden />
            Start Research
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunStats({ runs, lastDurationMs, updatedAt, onGoToRuns, accentColor = 'violet', label = 'run' }) {
  const attempts = runs?.length ?? 0;
  const lastRun = runs?.[0];
  const lastFailed = lastRun?.status === 'failed';

  let durationLabel = null;
  if (lastDurationMs != null) {
    const s = Math.round(lastDurationMs / 1000);
    durationLabel = `${s}s`;
  } else if (lastRun?.createdAt && lastRun?.updatedAt) {
    const ms = new Date(lastRun.updatedAt).getTime() - new Date(lastRun.createdAt).getTime();
    if (ms > 0) durationLabel = `${Math.round(ms / 1000)}s`;
  }

  return (
    <div className="space-y-2">
      {lastFailed && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800 dark:bg-rose-950/30">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
              Last {label} failed
            </p>
            {lastRun.errorMessage && (
              <p className="mt-0.5 text-xs text-rose-600/80 dark:text-rose-400/80 break-words">
                {lastRun.errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={onGoToRuns}
              className="mt-1 text-xs font-medium text-rose-700 underline hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100"
            >
              View full run log →
            </button>
          </div>
        </div>
      )}

      {attempts > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-lg border bg-muted/30 px-4 py-3">
          {[
            { label: 'Attempts', value: attempts },
            durationLabel && { label: 'Last run took', value: durationLabel },
            updatedAt && { label: 'Updated', value: formatDateTime(updatedAt) },
            {
              label: 'Last status',
              value: lastRun?.status ?? '—',
              cls:
                lastRun?.status === 'completed'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : lastRun?.status === 'failed'
                  ? 'text-rose-600 dark:text-rose-400'
                  : `text-${accentColor}-600 dark:text-${accentColor}-400`,
            },
          ]
            .filter(Boolean)
            .map(({ label: statLabel, value, cls }) => (
              <div key={statLabel} className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-muted-foreground">{statLabel}</span>
                <span className={cn('text-xs font-semibold tabular-nums capitalize', cls)}>
                  {value}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ResearchStats({ researchRuns, lastDurationMs, updatedAt, onGoToRuns }) {
  return (
    <RunStats
      runs={researchRuns}
      lastDurationMs={lastDurationMs}
      updatedAt={updatedAt}
      onGoToRuns={onGoToRuns}
      accentColor="violet"
      label="research run"
    />
  );
}

function ResearchTab({ articleId, research: serverResearch, isLoading, onRedo, onGoToRuns, researchRuns, lastDurationMs }) {
  const [redoOpen, setRedoOpen] = useState(false);

  // Local editable copy — re-syncs when server data changes (updatedAt is the signal)
  const [local, setLocal] = useState(serverResearch);
  const prevUpdatedAtRef = useRef(serverResearch?.updatedAt);
  useEffect(() => {
    const nextUpdatedAt = serverResearch?.updatedAt;
    if (nextUpdatedAt !== prevUpdatedAtRef.current || (!local && serverResearch)) {
      prevUpdatedAtRef.current = nextUpdatedAt;
      setLocal(serverResearch);
    }
  }, [serverResearch]);

  async function patchField(patch) {
    setLocal((prev) => ({ ...prev, ...patch }));
    try {
      await apiFetch(`/api/articles/${articleId}/automation/research`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch {
      toast.error('Could not save — changes may be lost on refresh');
    }
  }

  function saveKeyFact(index, value) {
    const updated = [...(local.keyFacts ?? [])];
    updated[index] = value;
    patchField({ keyFacts: updated });
  }

  function removeKeyFact(index) {
    const updated = (local.keyFacts ?? []).filter((_, i) => i !== index);
    patchField({ keyFacts: updated });
  }

  function addKeyFact() {
    patchField({ keyFacts: [...(local.keyFacts ?? []), ''] });
  }

  function saveQuery(index, value) {
    const updated = [...(local.searchQueries ?? [])];
    updated[index] = value;
    patchField({ searchQueries: updated });
  }

  function saveSourceField(index, field, value) {
    const updated = (local.sources ?? []).map((src, i) =>
      i === index ? { ...src, [field]: value } : src,
    );
    patchField({ sources: updated });
  }

  function saveNoteItem(category, index, value) {
    const notes = { ...(local.notes ?? {}) };
    const arr = Array.isArray(notes[category]) ? [...notes[category]] : [];
    arr[index] = value;
    notes[category] = arr;
    patchField({ notes });
  }

  if (isLoading) return <ResearchThinking />;

  if (!local) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No research data yet. Use the{' '}
            <span className="font-medium">Run Research</span> button above to kick off the
            research workflow.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <RedoResearchDialog
        open={redoOpen}
        onOpenChange={setRedoOpen}
        onConfirm={(angle) => onRedo(angle)}
      />

      <ResearchStats
        researchRuns={researchRuns}
        lastDurationMs={lastDurationMs}
        updatedAt={local?.updatedAt}
        onGoToRuns={onGoToRuns}
      />

      {/* Header row with redo + hint */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Double-click any field to edit inline.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          onClick={() => setRedoOpen(true)}
        >
          <FlaskConical className="size-3.5" aria-hidden />
          Redo Research
        </Button>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <InlineEditable
            value={local.summary ?? ''}
            multiline
            placeholder="No summary"
            className="block w-full text-sm leading-relaxed whitespace-pre-wrap text-foreground/90"
            onSave={(v) => patchField({ summary: v })}
          />
        </CardContent>
      </Card>

      {/* Key Facts */}
      {(local.keyFacts?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Key Facts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {local.keyFacts.map((fact, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-violet-500" />
                  <InlineEditable
                    value={fact}
                    className="flex-1 text-sm text-foreground/85"
                    onSave={(v) => saveKeyFact(i, v)}
                  />
                  <button
                    type="button"
                    onClick={() => removeKeyFact(i)}
                    className="mt-1.5 text-muted-foreground/50 hover:text-rose-500 transition-colors text-xs leading-none"
                    title="Remove"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addKeyFact}
              className="mt-3 text-xs text-violet-600 dark:text-violet-400 hover:underline"
            >
              + Add fact
            </button>
          </CardContent>
        </Card>
      )}

      {/* Sources */}
      {local.sources?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {local.sources.map((src, i) => (
                <div key={i} className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
                  <InlineEditable
                    value={typeof src === 'string' ? src : (src.title ?? '')}
                    className="block text-sm font-medium text-foreground leading-snug"
                    placeholder="Source title"
                    onSave={(v) =>
                      typeof src === 'string'
                        ? saveSourceField(i, 'title', v)
                        : saveSourceField(i, 'title', v)
                    }
                  />
                  {typeof src !== 'string' && (
                    <>
                      <InlineEditable
                        value={src.url ?? ''}
                        className="block text-xs text-primary break-all"
                        placeholder="URL"
                        onSave={(v) => saveSourceField(i, 'url', v)}
                      />
                      <InlineEditable
                        value={src.relevance ?? ''}
                        className="block text-xs text-muted-foreground"
                        placeholder="Relevance note"
                        onSave={(v) => saveSourceField(i, 'relevance', v)}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Queries */}
      {local.searchQueries?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Queries Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {local.searchQueries.map((q, i) => (
                <InlineEditable
                  key={i}
                  value={q}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80"
                  onSave={(v) => saveQuery(i, v)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {local.notes && Object.keys(local.notes).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(local.notes).map(([key, val]) => (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  {key}
                </p>
                {Array.isArray(val) ? (
                  <ul className="space-y-1.5">
                    {val.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        <InlineEditable
                          value={item}
                          className="flex-1 text-sm text-foreground/80"
                          onSave={(v) => saveNoteItem(key, i, v)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <InlineEditable
                    value={String(val)}
                    className="text-sm text-foreground/80"
                    onSave={(v) => {
                      const notes = { ...(local.notes ?? {}), [key]: v };
                      patchField({ notes });
                    }}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Automation Runs tab
// ---------------------------------------------------------------------------

function AutomationRunsTab({ runs }) {
  if (!runs?.length) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No automation runs yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => {
        const cfg = RUN_STATUS_CFG[run.status] ?? RUN_STATUS_CFG.running;
        const Icon = cfg.icon;
        return (
          <Card key={run.id}>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn('size-4 shrink-0', cfg.cls, cfg.spin && 'animate-spin')}
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {run.workflowType.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(run.createdAt)}
                      {run.n8nExecutionId ? ` · exec ${run.n8nExecutionId}` : ''}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'border-transparent text-xs',
                    run.status === 'completed' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                    run.status === 'running' && 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
                    run.status === 'failed' && 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                  )}
                >
                  {cfg.label}
                </Badge>
              </div>
              {run.errorMessage && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
                  <AlertTriangle className="size-3.5 mt-px shrink-0" aria-hidden />
                  {run.errorMessage}
                </div>
              )}
              {run.output && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    View output
                  </summary>
                  <pre className="mt-1 text-xs bg-muted rounded-md p-3 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(run.output, null, 2)}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset gallery
// ---------------------------------------------------------------------------

function RegenerateDialog({ open, onOpenChange, initialPrompt, onConfirm, pending }) {
  const [prompt, setPrompt] = useState(initialPrompt ?? '');
  const [refining, setRefining] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (open) {
      setPrompt(initialPrompt ?? '');
      setTimeout(() => ref.current?.focus(), 50);
    }
  }, [open, initialPrompt]);

  function handleConfirm() {
    onConfirm(prompt.trim() || initialPrompt);
    onOpenChange(false);
  }

  async function handleRefineWithAI() {
    if (!prompt.trim()) return;
    setRefining(true);
    try {
      const res = await apiFetch('/api/automation/refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (data?.refinedPrompt) {
        setPrompt(data.refinedPrompt);
        toast.success('Prompt refined by AI');
      } else {
        toast.error(data?.message || 'Could not refine prompt');
      }
    } catch {
      toast.error('Refiner request failed');
    } finally {
      setRefining(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Regenerate Artwork</DialogTitle>
          <DialogDescription>
            Edit the image description below, then confirm to queue a new generation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 mt-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Image prompt</label>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] gap-1 text-violet-600 hover:text-violet-700 dark:text-violet-400"
              disabled={refining || !prompt.trim()}
              onClick={handleRefineWithAI}
            >
              {refining
                ? <Loader2 className="size-3 animate-spin" />
                : <Sparkles className="size-3" />}
              {refining ? 'Refining…' : 'Refine with AI'}
            </Button>
          </div>
          <div className="relative">
            <Textarea
              ref={ref}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              disabled={refining}
              className={cn('transition-opacity', refining && 'opacity-50')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) handleConfirm();
                if (e.key === 'Escape') onOpenChange(false);
              }}
            />
            {refining && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/50 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400 font-medium">
                  <Sparkles className="size-3.5 animate-pulse" />
                  AI is refining your prompt…
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">⌘↵ to confirm · "Refine with AI" improves your prompt for better image generation</p>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={pending || refining} className="gap-1.5">
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
            Paint it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LightboxDialog({ open, onOpenChange, imageUrl, prompt, label }) {
  if (!imageUrl) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-2 sm:p-3 bg-black/95 border-white/10">
        <DialogHeader className="sr-only">
          <DialogTitle>{label ?? 'Image preview'}</DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={prompt}
          className="w-full max-h-[80vh] object-contain rounded-lg"
        />
        {label && (
          <p className="text-center text-[10px] text-white/40 font-medium uppercase tracking-wide">
            {label}
          </p>
        )}
        <p className="text-center text-[11px] text-white/60 px-2 pb-1 leading-snug">
          {prompt}
        </p>
      </DialogContent>
    </Dialog>
  );
}

function AssetCell({ req, articleId, onAssetPatched, onArticlePatched }) {
  const [regenOpen, setRegenOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [historyLightbox, setHistoryLightbox] = useState(null); // { imageUrl, prompt, version }
  const [redoPending, setRedoPending] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [headings, setHeadings] = useState(null); // null = not loaded yet
  const [loadingHeadings, setLoadingHeadings] = useState(false);
  const [placingIndex, setPlacingIndex] = useState(null); // which heading is being inserted after

  async function openPlaceDialog() {
    setPlaceOpen(true);
    if (headings !== null) return; // already loaded
    setLoadingHeadings(true);
    try {
      const res = await apiFetch(`/api/articles/${articleId}/automation/assets/${req.id}/insert`);
      const data = await res.json();
      setHeadings(data.headings ?? []);
    } catch {
      setHeadings([]);
    } finally {
      setLoadingHeadings(false);
    }
  }

  async function handlePlace(afterHeadingIndex) {
    setPlacingIndex(afterHeadingIndex);
    try {
      const res = await apiFetch(
        `/api/articles/${articleId}/automation/assets/${req.id}/insert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ afterHeadingIndex }),
        },
      );
      const data = await res.json();
      if (data?.ok !== true) {
        toast.error(data?.message || 'Could not place image');
      } else {
        if (data.article) onArticlePatched?.(data.article);
        toast.success('Image placed in article');
        setPlaceOpen(false);
      }
    } catch {
      toast.error('Could not place image');
    } finally {
      setPlacingIndex(null);
    }
  }

  async function handleRedo(prompt) {
    setRedoPending(true);
    try {
      const res = await apiFetch(`/api/articles/${articleId}/automation/assets/${req.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data?.ok === false) {
        toast.error(data.message || 'Regeneration failed');
      } else {
        if (data.asset) onAssetPatched?.([data.asset]);
        if (data.article) onArticlePatched?.(data.article);
        toast.success('Artwork regenerated');
      }
    } catch {
      toast.error('Could not regenerate artwork');
    } finally {
      setRedoPending(false);
    }
  }

  // While waiting for n8n to finish, treat this cell as "generating" visually
  const isGenerating = req.status === 'generating' || redoPending;
  const isFailed = !redoPending && req.status === 'failed';
  const isDone = !redoPending && req.status === 'completed' && req.imageUrl;
  const typeLabel = req.type === 'featured_image' ? 'Featured' : 'Inline';
  const history = req.history ?? [];
  const currentVersion = req.version ?? 1;

  return (
    <>
      <RegenerateDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        initialPrompt={req.prompt}
        onConfirm={handleRedo}
        pending={redoPending}
      />

      {/* Place-in-article dialog */}
      <Dialog open={placeOpen} onOpenChange={setPlaceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="size-4 text-emerald-600" />
              Place in article
            </DialogTitle>
            <DialogDescription>
              Choose where to insert this image inline in the article body.
            </DialogDescription>
          </DialogHeader>

          {loadingHeadings ? (
            <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> Reading article structure…
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => handlePlace(-1)}
                disabled={placingIndex !== null}
                className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                {placingIndex === -1
                  ? <Loader2 className="size-3.5 animate-spin shrink-0 text-emerald-600" />
                  : <ImagePlus className="size-3.5 shrink-0 text-emerald-600" />}
                <span className="font-medium">At the top of the article</span>
              </button>

              {headings?.length === 0 && (
                <p className="text-xs text-muted-foreground px-1 py-2">
                  No headings found — image will be placed at the top.
                </p>
              )}

              {headings?.map((h) => (
                <button
                  key={h.index}
                  type="button"
                  onClick={() => handlePlace(h.index)}
                  disabled={placingIndex !== null}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm hover:bg-muted/60 transition-colors disabled:opacity-50"
                >
                  {placingIndex === h.index
                    ? <Loader2 className="size-3.5 animate-spin shrink-0 text-emerald-600" />
                    : <ImagePlus className="size-3.5 shrink-0 text-muted-foreground" />}
                  <span className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1.5">
                      After {h.tag.toUpperCase()}
                    </span>
                    <span className="truncate">{h.text}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {isDone && (
        <LightboxDialog
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          imageUrl={req.imageUrl}
          prompt={req.prompt}
          label={`v${currentVersion} — current`}
        />
      )}
      {historyLightbox && (
        <LightboxDialog
          open={!!historyLightbox}
          onOpenChange={(o) => !o && setHistoryLightbox(null)}
          imageUrl={historyLightbox.imageUrl}
          prompt={historyLightbox.prompt}
          label={`v${historyLightbox.version}`}
        />
      )}

      <div className="group relative flex flex-col rounded-xl border bg-muted/10 overflow-hidden transition-all hover:border-border/60 hover:shadow-sm">
        {/* Image area — fixed ratio, no crop */}
        <div className="relative aspect-[4/3] w-full bg-muted/30 flex items-center justify-center overflow-hidden">
          {isDone ? (
            <button
              type="button"
              className="absolute inset-0 w-full h-full"
              onClick={() => setLightboxOpen(true)}
              aria-label="View full image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={req.imageUrl}
                alt={req.prompt}
                className="w-full h-full object-contain"
              />
              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <span className="rounded-full bg-white/80 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-foreground shadow">
                  View
                </span>
              </span>
            </button>
          ) : isGenerating ? (
            <CellPaintingLoader />
          ) : (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <ImageIcon className={cn('size-7 opacity-25', isFailed ? 'text-rose-400' : 'text-violet-400')} />
              <p className="text-[11px] text-foreground/60 leading-snug line-clamp-3 max-w-[90%]">
                {req.prompt}
              </p>
              {isFailed && req.errorMessage && (
                <p className="text-[10px] text-rose-500 break-words max-w-full">{req.errorMessage}</p>
              )}
            </div>
          )}
        </div>

        {/* Version history strip */}
        {history.length > 0 && (
          <div className="flex items-center gap-1.5 border-t bg-muted/20 px-2 py-1.5 overflow-x-auto">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60 shrink-0 mr-0.5">
              History
            </span>
            {history.map((h) => (
              <button
                key={h.id}
                type="button"
                title={`v${h.version} — click to preview`}
                onClick={() => setHistoryLightbox(h)}
                className="relative shrink-0 size-8 rounded overflow-hidden border border-border/60 hover:border-primary/60 transition-all hover:scale-110 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.imageUrl} alt={`v${h.version}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-bold text-center leading-tight py-px">
                  v{h.version}
                </span>
              </button>
            ))}
            {isDone && (
              <button
                type="button"
                title={`v${currentVersion} — current`}
                onClick={() => setLightboxOpen(true)}
                className="relative shrink-0 size-8 rounded overflow-hidden border-2 border-primary/70 transition-all hover:scale-110 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={req.imageUrl} alt={`v${currentVersion}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-primary/80 text-white text-[8px] font-bold text-center leading-tight py-px">
                  v{currentVersion}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Footer bar */}
        <div className="flex items-center justify-between gap-2 border-t bg-card px-3 py-2">
          <div className="min-w-0">
            <span className={cn(
              'text-[10px] font-semibold uppercase tracking-wide',
              isFailed ? 'text-rose-500' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-500',
            )}>
              {typeLabel}
            </span>
            <p className="text-[11px] text-muted-foreground truncate">{req.placementKey}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isDone && req.placementKey !== 'hero-featured' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                disabled={placingIndex !== null}
                onClick={openPlaceDialog}
                title="Insert this image into the article content"
              >
                <ImagePlus className="size-3" />
                Place
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
              disabled={redoPending || isGenerating}
              onClick={() => setRegenOpen(true)}
            >
              {redoPending ? <Loader2 className="size-3 animate-spin" /> : <FlaskConical className="size-3" />}
              Redo
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function AssetRequestsTab({ requests, articleId, onAssetPatched, onArticlePatched }) {
  if (!requests?.length) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No artwork requests yet. They are created automatically when the writing workflow
            completes.
          </p>
        </CardContent>
      </Card>
    );
  }

  const counts = {
    pending: requests.filter((r) => r.status === 'pending').length,
    generating: requests.filter((r) => r.status === 'generating').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    failed: requests.filter((r) => r.status === 'failed').length,
  };

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        {counts.completed > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-700 dark:text-emerald-300">
            {counts.completed} complete
          </span>
        )}
        {counts.generating > 0 && (
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-amber-700 dark:text-amber-300">
            {counts.generating} painting
          </span>
        )}
        {counts.pending > 0 && (
          <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-sky-700 dark:text-sky-300">
            {counts.pending} waiting
          </span>
        )}
        {counts.failed > 0 && (
          <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-rose-700 dark:text-rose-300">
            {counts.failed} failed
          </span>
        )}
      </div>

      {/* Uniform grid — all same size */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {requests.map((req) => (
          <AssetCell key={req.id} req={req} articleId={articleId} onAssetPatched={onAssetPatched} onArticlePatched={onArticlePatched} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(v) {
  if (!v) return '—';
  try {
    return format(
      typeof v === 'string' ? parseISO(v) : v instanceof Date ? v : parseISO(String(v)),
      'PP',
    );
  } catch {
    return '—';
  }
}

function formatDateTime(v) {
  if (!v) return '—';
  try {
    return format(
      typeof v === 'string' ? parseISO(v) : v instanceof Date ? v : parseISO(String(v)),
      'PPp',
    );
  } catch {
    return '—';
  }
}

function readinessForArticle(article) {
  const now = new Date();
  if (!article.readinessDeadline || !article.publishDate) return 'on_track';
  const pd =
    article.publishDate instanceof Date
      ? article.publishDate
      : parseISO(String(article.publishDate));
  const rd =
    article.readinessDeadline instanceof Date
      ? article.readinessDeadline
      : parseISO(String(article.readinessDeadline));
  if (Number.isNaN(pd.getTime()) || Number.isNaN(rd.getTime())) return 'on_track';
  if (now > pd && article.status !== 'post_publish' && article.status !== 'publishing') {
    return 'overdue';
  }
  if (now > rd && now <= pd) return 'at_risk';
  return 'on_track';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ArticleDetailContent({
  article,
  versions = [],
  activityLogs = [],
  research = null,
  assetRequests = [],
  automationRuns = [],
}) {
  const router = useRouter();
  const [previewVersion, setPreviewVersion] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Local article data — updated in-place after mutations (no page refresh needed)
  const [localContent, setLocalContent] = useState(article.content ?? null);
  const [localAssets, setLocalAssets] = useState(assetRequests);
  const [localFeaturedImage, setLocalFeaturedImage] = useState(article.featuredImage ?? null);

  function patchAssets(updatedAssets) {
    if (!updatedAssets?.length) return;
    setLocalAssets((prev) => {
      const map = new Map(updatedAssets.map((a) => [a.id, a]));
      return prev.map((a) => (map.has(a.id) ? { ...a, ...map.get(a.id) } : a));
    });
    // If the hero asset was updated, reflect it at the top of the page immediately
    const hero = updatedAssets.find(
      (a) => a.placementKey === 'hero-featured' && a.status === 'completed' && a.imageUrl,
    );
    if (hero) setLocalFeaturedImage(hero.imageUrl);
  }

  function patchArticle(articleData) {
    if (!articleData) return;
    if (articleData.content) setLocalContent(articleData.content);
    if (articleData.featuredImage) setLocalFeaturedImage(articleData.featuredImage);
  }

  async function handleDeleteContentImage(src) {
    if (!localContent || localContent.type !== 'html') return;

    // Remove the <figure>...</figure> that contains this img, or just the <img> tag
    const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let updated = localContent.html;

    const figureRe = /<figure[^>]*>[\s\S]*?<\/figure>/gi;
    let removedFigure = false;
    updated = updated.replace(figureRe, (match) => {
      if (!removedFigure && match.includes(src)) {
        removedFigure = true;
        return '';
      }
      return match;
    });

    if (!removedFigure) {
      updated = updated.replace(new RegExp(`<img[^>]*src="${escapedSrc}"[^>]*>`, 'gi'), '');
    }

    const newContent = { ...localContent, html: updated };
    setLocalContent(newContent);

    try {
      await apiFetch(`/api/articles/${article.id}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });
    } catch {
      toast.error('Could not save content — image removed locally only');
    }
  }
  const [isResearching, setIsResearching] = useState(false);
  const [researchDone, setResearchDone] = useState(!!research);
  const [lastResearchDurationMs, setLastResearchDurationMs] = useState(null);
  const researchStartRef = useRef(null);

  const [isWriting, setIsWriting] = useState(false);
  const [writingDone, setWritingDone] = useState(!!article.content); // seeded from server prop
  const [animateContent, setAnimateContent] = useState(false);
  const [lastWritingDurationMs, setLastWritingDurationMs] = useState(null);
  const writeStartRef = useRef(null);

  const [lastAssetsDurationMs, setLastAssetsDurationMs] = useState(null);
  const assetsStartRef = useRef(null);

  const current = article.status;
  const readiness = readinessForArticle(article);
  const embed = toYoutubeEmbedUrl(article.videoUrl);

  const researchMutation = useMutation({
    mutationFn: (angle) =>
      apiFetch(`/api/articles/${article.id}/automation/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(angle ? { angle } : {}),
      }).then((r) => r.json()),
    onMutate: () => {
      setActiveTab('research');
      setIsResearching(true);
      setResearchDone(false);
      researchStartRef.current = Date.now();
    },
    onSuccess: (data) => {
      setIsResearching(false);
      if (data?.ok !== true) {
        setResearchDone(false);
        toast.error(data?.message || 'Research failed', { duration: 8000 });
      } else {
        if (researchStartRef.current) {
          setLastResearchDurationMs(Date.now() - researchStartRef.current);
        }
        setResearchDone(true);
        toast.success('Research complete');
        router.refresh();
      }
    },
    onError: (err) => {
      setIsResearching(false);
      setResearchDone(false);
      toast.error(err?.message || 'Research failed — check console', { duration: 8000 });
    },
  });

  const assetsMutation = useMutation({
    mutationFn: async () => {
      // Get a snapshot of which assets need generating right now
      const pending = localAssets.filter(
        (a) => a.status === 'pending' || a.status === 'failed',
      );
      if (!pending.length) return { ok: true };

      let anySucceeded = false;
      for (const asset of pending) {
        // Mark only this cell as generating
        setLocalAssets((prev) =>
          prev.map((a) => (a.id === asset.id ? { ...a, status: 'generating' } : a)),
        );

        try {
          const res = await apiFetch(
            `/api/articles/${article.id}/automation/assets/${asset.id}`,
            { method: 'POST' },
          );
          const data = await res.json();

          if (data.asset) patchAssets([data.asset]);
          if (data.article) patchArticle(data.article);
          if (data.asset?.status === 'completed') anySucceeded = true;
        } catch {
          // Mark this cell failed and continue to next
          setLocalAssets((prev) =>
            prev.map((a) =>
              a.id === asset.id ? { ...a, status: 'failed', errorMessage: 'Request failed' } : a,
            ),
          );
        }
      }

      return { ok: true, anySucceeded };
    },
    onMutate: () => {
      setActiveTab('assets');
      assetsStartRef.current = Date.now();
    },
    onSuccess: () => {
      if (assetsStartRef.current) {
        setLastAssetsDurationMs(Date.now() - assetsStartRef.current);
      }
      toast.success('Asset generation complete');
    },
    onError: (err) => {
      toast.error(err?.message || 'Asset generation failed — check console', { duration: 8000 });
    },
  });

  function handleActionDone() {
    router.refresh();
  }

  // angle is optional — comes from the redo dialog
  function handleRedo(angle) {
    setResearchDone(false);
    researchMutation.mutate(angle || undefined);
  }

  const writingMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/articles/${article.id}/automation/write`, { method: 'POST' }).then(
        (r) => r.json(),
      ),
    onMutate: () => {
      setActiveTab('content');
      setIsWriting(true);
      setWritingDone(false);
      setLocalContent(null);
      setLocalAssets([]);
      writeStartRef.current = Date.now();
    },
    onSuccess: (data) => {
      setIsWriting(false);
      if (data?.ok !== true) {
        setWritingDone(false);
        toast.error(data?.message || 'Writing failed', { duration: 8000 });
      } else {
        if (writeStartRef.current) {
          setLastWritingDurationMs(Date.now() - writeStartRef.current);
        }
        // Apply fresh data from the server in-place — no page refresh
        if (data.article?.content) setLocalContent(data.article.content);
        if (data.article?.featuredImage) setLocalFeaturedImage(data.article.featuredImage);
        if (data.assets?.length) setLocalAssets(data.assets);
        setWritingDone(true);
        setAnimateContent(true);
        toast.success('Writing complete');
      }
    },
    onError: (err) => {
      setIsWriting(false);
      setWritingDone(false);
      toast.error(err?.message || 'Writing failed — check console', { duration: 8000 });
    },
  });

  return (
    <Container>
      {/* Automation control panel */}
      <AutomationPanel
        articleId={article.id}
        researchMutation={researchMutation}
        researchDone={researchDone}
        isResearching={isResearching}
        writingMutation={writingMutation}
        writingDone={writingDone}
        isWriting={isWriting}
        assetsMutation={assetsMutation}
        assetsDone={localAssets.length > 0 && localAssets.every((a) => a.status === 'completed')}
        hasResearch={!!research}
        assetRequests={localAssets}
        onActionDone={handleActionDone}
      />

      {/* Pipeline progress */}
      <div className="mb-5 rounded-xl border border-border/80 bg-muted/20 p-3 shadow-sm ring-1 ring-border/30 sm:p-4">
        <p className="mb-2.5 text-xs font-semibold tracking-wide text-foreground/70">
          Pipeline
        </p>
        <PipelineProgress stages={PIPELINE_STAGES} currentStage={current} />
      </div>

      {/* Article hero / header */}
      <div className="relative mb-6 overflow-hidden rounded-xl border bg-muted/20">
        {localFeaturedImage ? (
          <div className="relative aspect-[21/9] max-h-[320px] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={localFeaturedImage}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <PipelineStageBadge stage={current} />
                <ReadinessBadge readiness={readiness} />
                {article.isEditorsChoice && (
                  <Badge variant="warning" appearance="light" className="gap-1">
                    <Star className="size-3.5" />
                    Editor&apos;s choice
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground drop-shadow-sm">
                {article.title}
              </h1>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <PipelineStageBadge stage={current} />
              <ReadinessBadge readiness={readiness} />
              {article.isEditorsChoice && (
                <Badge variant="warning" appearance="light" className="gap-1">
                  <Star className="size-3.5" />
                  Editor&apos;s choice
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{article.title}</h1>
          </div>
        )}
        <div className="flex flex-wrap gap-4 border-t bg-card/80 px-5 py-3 text-sm">
          <span>
            <span className="text-muted-foreground">Views</span>{' '}
            <span className="font-medium tabular-nums">{article.views ?? 0}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Likes</span>{' '}
            <span className="font-medium tabular-nums">{article.likes ?? 0}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Comments</span>{' '}
            <span className="font-medium tabular-nums">{article.commentsCount ?? 0}</span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {[
            ['overview', 'Overview'],
            ['research', 'Research'],
            ['content', 'Content'],
            ['assets', `Assets${localAssets.length ? ` (${localAssets.length})` : ''}`],
            ['automation', `Runs${automationRuns.length ? ` (${automationRuns.length})` : ''}`],
            ['pipeline', 'Pipeline'],
            ['seo', 'SEO'],
            ['social', 'Social'],
            ['versions', 'Versions'],
            ['activity', 'Activity'],
          ].map(([id, label]) => (
            <TabsTrigger key={id} value={id} className="text-xs sm:text-sm gap-1.5">
              {((id === 'research' && isResearching) ||
                (id === 'content' && isWriting) ||
                (id === 'assets' && assetsMutation.isPending)) && (
                <Loader2 className="size-3 animate-spin text-amber-500 shrink-0" aria-hidden />
              )}
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">
                {article.summary || 'No summary yet.'}
              </p>
            </CardContent>
          </Card>
          {embed ? (
            <Card>
              <CardHeader>
                <CardTitle>Video</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video max-w-3xl overflow-hidden rounded-md border bg-black">
                  <iframe
                    title="Article video"
                    src={embed}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          ) : article.videoUrl ? (
            <Card>
              <CardContent className="pt-6">
                <a
                  href={article.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline"
                >
                  Open video link
                </a>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Meta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Topic</span>
                <p>
                  <Link
                    className="text-primary hover:underline"
                    href={`/dashboard/topics/${article.topicId}`}
                  >
                    {article.topicName}
                  </Link>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Category</span>
                <p>
                  <Link
                    className="text-primary hover:underline"
                    href={`/dashboard/categories/${article.categoryId}`}
                  >
                    {article.categoryName}
                  </Link>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Publish</span>
                <p>{formatDate(article.publishDate)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Ready by</span>
                <p>{formatDate(article.readinessDeadline)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Target keyword</span>
                <p>
                  <code className="text-xs bg-muted px-1 rounded">
                    {article.targetKeyword || '—'}
                  </code>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">WordPress</span>
                {article.wordpressPostId != null ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm">WP #{article.wordpressPostId}</p>
                    {article.featuredImage && (
                      <SyncImageButton articleId={article.id} />
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not synced</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content */}
        <TabsContent value="content" className="mt-4 space-y-4">
          {(() => {
            const writingRuns = automationRuns.filter((r) => r.workflowType === 'writing');
            const hasContent = !!localContent;
            return (
              <>
                {/* Stats + redo — shown when not actively writing */}
                {!isWriting && (
                  <>
                    <RunStats
                      runs={writingRuns}
                      lastDurationMs={lastWritingDurationMs}
                      updatedAt={hasContent ? article.updatedAt : null}
                      onGoToRuns={() => setActiveTab('automation')}
                      accentColor="blue"
                      label="writing run"
                    />
                    {hasContent && (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] text-muted-foreground">
                          Re-running writing will clear existing asset requests.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={writingMutation.isPending || !research}
                          onClick={() => {
                            setWritingDone(false);
                            setAnimateContent(false);
                            setLocalContent(null);
                            setLocalAssets([]);
                            writingMutation.mutate();
                          }}
                          title={!research ? 'Complete research first' : undefined}
                          className="gap-1.5 shrink-0"
                        >
                          <PenLine className="size-3.5" aria-hidden />
                          Redo Writing
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {isWriting ? (
                  <WritingLoader />
                ) : hasContent ? (
                  <div className={cn(animateContent && 'animate-in fade-in duration-700')}>
                    <ContentRenderer content={localContent} onDeleteImage={handleDeleteContentImage} />
                    {article.galleryImages?.length > 0 && (
                      <Card className="mt-4">
                        <CardHeader><CardTitle>Gallery</CardTitle></CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                            {article.galleryImages.map((url) => (
                              <div key={url} className="aspect-square overflow-hidden rounded-md border bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">
                        No content yet. Use <span className="font-medium">Run Writing</span> to generate the article.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* Research */}
        <TabsContent value="research" className="mt-4">
          <ResearchTab
            articleId={article.id}
            research={research}
            isLoading={isResearching}
            onRedo={handleRedo}
            onGoToRuns={() => setActiveTab('automation')}
            researchRuns={automationRuns.filter((r) => r.workflowType === 'research')}
            lastDurationMs={lastResearchDurationMs}
          />
        </TabsContent>

        {/* Assets */}
        <TabsContent value="assets" className="mt-4 space-y-4">
          {(() => {
            const assetRuns = automationRuns.filter((r) => r.workflowType === 'image_generation');
            return (
              <>
                <RunStats
                  runs={assetRuns}
                  lastDurationMs={lastAssetsDurationMs}
                  updatedAt={null}
                  onGoToRuns={() => setActiveTab('automation')}
                  accentColor="amber"
                  label="image generation run"
                />
                <AssetRequestsTab requests={localAssets} articleId={article.id} onAssetPatched={patchAssets} onArticlePatched={patchArticle} />
              </>
            );
          })()}
        </TabsContent>

        {/* Automation Runs */}
        <TabsContent value="automation" className="mt-4">
          <AutomationRunsTab runs={automationRuns} />
        </TabsContent>

        {/* Pipeline */}
        <TabsContent value="pipeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>
                The horizontal progress bar at the top of the page shows all stages. Your
                current stage is always visible there.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Stage changes are recorded in Activity; content snapshots before edits live
                under Versions.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social */}
        <TabsContent value="social" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {['Instagram', 'X (Twitter)', 'YouTube', 'LinkedIn'].map((label) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription>Planned in Milestone 10</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Post-publish copy and status will be tracked here.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <MilestoneNote className="mt-4" milestone={10}>
            Full social output workflow activates in Milestone 10.
          </MilestoneNote>
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between max-w-sm">
                <span className="text-muted-foreground">Score</span>
                <span>{article.seoScore != null ? article.seoScore : '—'}</span>
              </div>
              <div className="flex justify-between max-w-sm">
                <span className="text-muted-foreground">Internal links</span>
                <span>— (M10)</span>
              </div>
            </CardContent>
          </Card>
          <MilestoneNote className="mt-4" milestone={10}>
            Rule-based SEO checks and link suggestions in Milestone 10.
          </MilestoneNote>
        </TabsContent>

        {/* Versions */}
        <TabsContent value="versions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" aria-hidden />
                Version history
              </CardTitle>
              <CardDescription>
                Snapshots taken before title, summary, or body changes. Open a preview to
                compare with the current article.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No saved versions yet. Edit the article to create the first snapshot.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {versions.map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {v.versionLabel || v.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(v.createdAt)}
                          {v.createdByLabel ? ` · ${v.createdByLabel}` : ''}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewVersion(v)}
                      >
                        Preview
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Content activity</CardTitle>
              <CardDescription>
                Logged operations for this article (create, update, delete, pipeline events).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activityLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No log entries yet.</p>
              ) : (
                activityLogs.map((a) => (
                  <div key={a.id}>
                    <p className="text-sm font-medium text-foreground">{a.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {[a.action, a.type].filter(Boolean).join(' · ') || a.type}
                      {' · '}
                      {formatDateTime(a.createdAt)}
                      {a.userLabel ? ` · ${a.userLabel}` : ''}
                    </p>
                    <Separator className="mt-3" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Version preview dialog */}
      <Dialog open={!!previewVersion} onOpenChange={(o) => !o && setPreviewVersion(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {previewVersion ? (
            <>
              <DialogHeader>
                <DialogTitle>{previewVersion.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(previewVersion.createdAt)}
                  {previewVersion.createdByLabel
                    ? ` · ${previewVersion.createdByLabel}`
                    : ''}
                </p>
                {previewVersion.summary ? (
                  <p className="leading-relaxed text-foreground/90">{previewVersion.summary}</p>
                ) : (
                  <p className="text-muted-foreground italic">No summary in this version.</p>
                )}
                <Separator />
                <ContentRenderer content={previewVersion.content} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
