'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

// Pipeline stages in order
const STAGES = [
  { key: 'planning', label: 'Plan' },
  { key: 'research', label: 'Research' },
  { key: 'writing', label: 'Write' },
  { key: 'assets', label: 'Assets' },
  { key: 'approval', label: 'Approval' },
];

// Status-to-stage index mapping: which stage is "completed" up to
const STATUS_STAGE_INDEX = {
  planning: 0,
  research: 1,
  writing: 2,
  assets: 3,
  approval: 4,
  scheduling: 5,
  publishing: 5,
  post_publish: 5,
};

function StageNode({ stage, state, isLast }) {
  // state: 'done' | 'active' | 'pending'
  return (
    <div className="flex items-center gap-0">
      <div className="flex flex-col items-center gap-1.5">
        {/* Node */}
        <div className="relative flex items-center justify-center">
          {state === 'active' && (
            <>
              <span className="absolute size-8 rounded-full bg-primary/20 animate-ping" />
              <span className="absolute size-6 rounded-full bg-primary/30 animate-pulse" />
            </>
          )}
          <div
            className={cn(
              'relative z-10 flex size-7 items-center justify-center rounded-full border-2 transition-all duration-500',
              state === 'done' && 'border-emerald-500 bg-emerald-500/10',
              state === 'active' && 'border-primary bg-primary/10 shadow-[0_0_10px_rgba(var(--primary),0.4)]',
              state === 'pending' && 'border-border bg-muted/30',
            )}
          >
            {state === 'done' ? (
              <CheckCircle2 className="size-4 text-emerald-500" />
            ) : state === 'active' ? (
              <span className="size-2.5 rounded-full bg-primary animate-pulse" />
            ) : (
              <span className="size-2 rounded-full bg-muted-foreground/30" />
            )}
          </div>
        </div>

        {/* Label */}
        <span
          className={cn(
            'text-[11px] font-medium transition-colors duration-300 whitespace-nowrap',
            state === 'done' && 'text-emerald-600 dark:text-emerald-400',
            state === 'active' && 'text-primary font-semibold',
            state === 'pending' && 'text-muted-foreground/50',
          )}
        >
          {stage.label}
        </span>
      </div>

      {/* Connector line */}
      {!isLast && (
        <div
          className={cn(
            'h-0.5 w-8 sm:w-12 mb-5 transition-all duration-500',
            state === 'done' ? 'bg-emerald-500/60' : 'bg-border/60',
          )}
        />
      )}
    </div>
  );
}

/**
 * Shows the 5-stage pipeline with nodes lighting up based on article status.
 *
 * @param {{ articleStatus?: string; currentStep?: string|null; articleTitle?: string }} props
 */
export function PipelineProgress({ articleStatus, currentStep, articleTitle }) {
  const completedUpTo = STATUS_STAGE_INDEX[articleStatus ?? 'planning'] ?? 0;

  // The "active" stage is derived from currentStep (engine's live step) or article status
  const activeKey = currentStep ?? articleStatus ?? null;

  const getState = (stage, stageIdx) => {
    const activeIdx = STAGES.findIndex((s) => s.key === activeKey);

    if (activeIdx >= 0) {
      if (stageIdx < activeIdx) return 'done';
      if (stageIdx === activeIdx) return 'active';
      return 'pending';
    }

    // Fallback: use completedUpTo
    if (stageIdx < completedUpTo) return 'done';
    if (stageIdx === completedUpTo) return 'active';
    return 'pending';
  };

  return (
    <div className="flex flex-col gap-3">
      {articleTitle && (
        <p className="text-sm font-medium text-center truncate px-2" title={articleTitle}>
          {articleTitle}
        </p>
      )}

      <div className="flex items-start justify-center flex-wrap gap-0 overflow-x-auto">
        {STAGES.map((stage, idx) => (
          <StageNode
            key={stage.key}
            stage={stage}
            state={getState(stage, idx)}
            isLast={idx === STAGES.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
