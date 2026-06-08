'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, AlertTriangle, Clock, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ENGINE_UI = {
  research: {
    icon: '🔬',
    label: 'Research',
    description: 'Turns planning articles into researched drafts',
    accentClass: 'text-sky-600 dark:text-sky-400',
    dotClass: 'bg-sky-500',
    badgeRunning: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  },
  writing: {
    icon: '✍️',
    label: 'Writing',
    description: 'Writes full articles from research',
    accentClass: 'text-violet-600 dark:text-violet-400',
    dotClass: 'bg-violet-500',
    badgeRunning: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  },
  images: {
    icon: '🎨',
    label: 'Images',
    description: 'Generates featured & inline images',
    accentClass: 'text-amber-600 dark:text-amber-400',
    dotClass: 'bg-amber-500',
    badgeRunning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
};

const STATUS_CONFIG = {
  idle:    { label: 'Idle',    dot: 'bg-slate-400',             badge: 'bg-slate-400/15 text-slate-600 dark:text-slate-400 border-slate-400/30' },
  waiting: { label: 'Waiting', dot: 'bg-sky-400 animate-pulse', badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30' },
  running: { label: 'Running', dot: 'animate-pulse',            badge: '' },
  paused:  { label: 'Paused',  dot: 'bg-amber-500',             badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
};

// ---------------------------------------------------------------------------
// Countdown hook — counts down from nextRunMs to 0
// ---------------------------------------------------------------------------

function useCountdown(nextRunMs) {
  const [remaining, setRemaining] = useState(nextRunMs ?? 0);

  useEffect(() => {
    if (!nextRunMs || nextRunMs <= 0) {
      setRemaining(0);
      return;
    }
    setRemaining(nextRunMs);
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [nextRunMs]);

  return remaining;
}

function formatMs(ms) {
  if (ms <= 0) return null;
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// EngineCard
// ---------------------------------------------------------------------------

export function EngineCard({
  engineId,
  engine,
  n8nAvailable,
  queueCount,
  skippedCount,
  onStart,
  onPause,
  onSettingsChange,
  isStartPending,
  isPausePending,
}) {
  const ui = ENGINE_UI[engineId];
  const status = engine?.status ?? 'idle';
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';
  const isStalled = engine?.isStalled ?? false;
  const isWaiting = engine?.isWaiting ?? false;
  const displayStatus = isWaiting ? 'waiting' : status;

  const [localDelay, setLocalDelay] = useState(engine?.delayMinutes ?? 0);
  const [delaySaving, setDelaySaving] = useState(false);

  // Keep local in sync when data refreshes (but don't overwrite while editing)
  useEffect(() => {
    setLocalDelay(engine?.delayMinutes ?? 0);
  }, [engine?.delayMinutes]);

  const countdown = useCountdown(isRunning ? engine?.nextRunMs : null);

  const canStart = (isIdle || isPaused || isStalled) && n8nAvailable;
  const canPause = isRunning && !isStalled;

  const statusCfg = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.idle;
  const badgeClass = displayStatus === 'running' ? ui.badgeRunning : statusCfg.badge;
  const dotClass = displayStatus === 'running' ? `${ui.dotClass} animate-pulse` : statusCfg.dot;

  async function saveDelay(val) {
    const num = Math.max(0, Math.min(1440, Number(val) || 0));
    setLocalDelay(num);
    setDelaySaving(true);
    try {
      await onSettingsChange(engineId, num);
    } finally {
      setDelaySaving(false);
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{ui.icon}</span>
            <div>
              <CardTitle className="text-sm font-semibold">{ui.label}</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{ui.description}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${badgeClass}`}
          >
            <span className={`size-1.5 rounded-full ${dotClass}`} />
            {statusCfg.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 flex flex-col gap-3 flex-1">
        {/* Stall warning */}
        {isStalled && (
          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-rose-500/30 bg-rose-500/5">
            <AlertTriangle className="size-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-700 dark:text-rose-400">
              Engine may have stalled — restart to resume.
            </p>
          </div>
        )}

        {/* Skipped warning */}
        {skippedCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <SkipForward className="size-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {skippedCount} article{skippedCount !== 1 ? 's' : ''} skipped this session
            </p>
          </div>
        )}

        {/* Currently processing */}
        {isRunning && engine?.currentArticle && (
          <div className="px-2.5 py-2 rounded-lg bg-muted/40 border border-border/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Processing</p>
            <p className="text-xs font-medium leading-snug line-clamp-2">{engine.currentArticle.title}</p>
          </div>
        )}
        {isWaiting && !engine?.currentArticle && (
          <p className="text-[11px] text-muted-foreground/70 italic">
            Watching for new articles…
          </p>
        )}

        {/* Countdown when rate-limited */}
        {isRunning && countdown > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3.5 flex-shrink-0" />
            <p className="text-[11px]">Next job in {formatMs(countdown)}</p>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span className="text-sm font-bold">{engine?.totalProcessed ?? 0}</span>
            <span className="text-[10px] text-muted-foreground">done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="size-3.5 text-rose-500" />
            <span className="text-sm font-bold">{engine?.totalFailed ?? 0}</span>
            <span className="text-[10px] text-muted-foreground">failed</span>
          </div>
        </div>

        {/* Rate setting */}
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-muted-foreground flex-shrink-0" />
          <label className="text-[11px] text-muted-foreground flex-shrink-0">Every</label>
          <input
            type="number"
            min="0"
            max="1440"
            value={localDelay}
            onChange={(e) => setLocalDelay(e.target.value)}
            onBlur={(e) => saveDelay(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveDelay(e.target.value)}
            className="w-14 px-2 py-1 text-xs rounded border border-border bg-background text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-[11px] text-muted-foreground flex-shrink-0">
            {delaySaving ? 'saving…' : 'min'}
          </span>
          {localDelay == 0 && (
            <span className="text-[10px] text-muted-foreground/60">(no delay)</span>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2 mt-auto pt-1">
          {canStart && (
            <Button
              size="sm"
              className="flex-1 h-7 text-xs gap-1.5"
              onClick={() => onStart(engineId)}
              disabled={isStartPending}
            >
              <Play className="size-3" />
              {isStalled ? 'Restart' : isPaused ? 'Resume' : 'Start'}
            </Button>
          )}
          {canPause && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs gap-1.5"
              onClick={() => onPause(engineId)}
              disabled={isPausePending}
            >
              <Pause className="size-3" />
              Pause
            </Button>
          )}
          {!canStart && !canPause && (
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" disabled>
              {!n8nAvailable ? 'AI offline' : 'Running'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
