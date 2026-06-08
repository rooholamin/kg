'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Idle antics — rotate randomly every 12 s when the engine is idle
// ---------------------------------------------------------------------------

const IDLE_ANTICS = [
  { emoji: '😴', label: 'Napping at the desk…', animation: 'animate-sleeping' },
  { emoji: '📰', label: 'Reading the news…', animation: 'animate-reading' },
  { emoji: '✏️', label: 'Doodling on the notepad…', animation: 'animate-doodling' },
  { emoji: '🕺', label: 'Doing a little dance…', animation: 'animate-dancing' },
  { emoji: '😑', label: 'Staring into the void…', animation: 'animate-staring' },
  { emoji: '☕', label: 'Getting another coffee…', animation: 'animate-coffee' },
  { emoji: '🎮', label: 'Playing games…', animation: 'animate-gaming' },
  { emoji: '🪴', label: 'Watering the plant…', animation: 'animate-watering' },
];

const STEP_CONFIG = {
  research: { emoji: '🔍', label: 'Deep-diving the research…', animation: 'animate-researching' },
  writing: { emoji: '✍️', label: 'Crafting the article…', animation: 'animate-writing' },
  assets: { emoji: '🎨', label: 'Generating visuals…', animation: 'animate-assets' },
};

const STATUS_CONFIG = {
  running: { emoji: '💻', label: 'Working hard…', ring: 'ring-emerald-500/40 bg-emerald-500/5' },
  paused: { emoji: '🤔', label: 'Taking a breather…', ring: 'ring-amber-500/40 bg-amber-500/5' },
  idle: { emoji: '😴', label: 'Waiting for work…', ring: 'ring-slate-400/30 bg-muted/30' },
};

// ---------------------------------------------------------------------------
// Character desk scene
// ---------------------------------------------------------------------------

function DeskScene({ emoji, animation }) {
  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Desk lamp */}
      <div className="absolute -top-2 right-8 w-1 h-10 bg-border rounded-full origin-bottom" style={{ transform: 'rotate(-15deg)' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-3 bg-muted-foreground/30 rounded-t-full" />
      </div>

      {/* Character */}
      <div className={cn('text-6xl mb-3 transition-all duration-700', animation)}>
        {emoji}
      </div>

      {/* Desk surface */}
      <div className="relative w-52 h-8 bg-gradient-to-b from-muted to-muted/50 rounded-lg border border-border shadow-sm flex items-center justify-around px-3">
        {/* Laptop */}
        <div className="w-12 h-5 bg-slate-700 dark:bg-slate-600 rounded-sm border border-slate-600 dark:border-slate-500 flex items-center justify-center">
          <div className="w-10 h-3 bg-sky-400/40 rounded-sm text-[4px] text-sky-200 flex items-center justify-center overflow-hidden">
            ▓▒░
          </div>
        </div>
        {/* Coffee cup */}
        <div className="w-4 h-5 bg-amber-800/70 rounded-b-sm border border-amber-700/50 relative">
          <div className="absolute -top-1 left-0 right-0 h-1.5 bg-amber-100/60 rounded-t-full" />
        </div>
        {/* Papers */}
        <div className="flex flex-col gap-px">
          <div className="w-6 h-0.5 bg-muted-foreground/40 rounded-full" />
          <div className="w-5 h-0.5 bg-muted-foreground/30 rounded-full" />
          <div className="w-4 h-0.5 bg-muted-foreground/20 rounded-full" />
        </div>
      </div>

      {/* Desk legs */}
      <div className="flex gap-32 mt-0.5">
        <div className="w-1.5 h-4 bg-border rounded-b" />
        <div className="w-1.5 h-4 bg-border rounded-b" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status ring indicator
// ---------------------------------------------------------------------------

function StatusRing({ status, children }) {
  return (
    <div
      className={cn(
        'relative p-5 rounded-2xl ring-2 transition-all duration-700',
        STATUS_CONFIG[status]?.ring ?? 'ring-border bg-muted/20',
        status === 'running' && 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
      )}
    >
      {status === 'running' && (
        <span className="absolute inset-0 rounded-2xl ring-2 ring-emerald-500/20 animate-ping" />
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main EditorInChief component
// ---------------------------------------------------------------------------

/**
 * Animated "Editor in Chief" character that reflects engine state.
 *
 * @param {{ status: 'idle'|'running'|'paused'; currentStep?: string|null }} props
 */
export function EditorInChief({ status, currentStep }) {
  const [idleIndex, setIdleIndex] = useState(0);
  const timerRef = useRef(null);

  // Rotate idle antics every 12 s
  useEffect(() => {
    if (status === 'idle') {
      timerRef.current = setInterval(() => {
        setIdleIndex((i) => (i + 1) % IDLE_ANTICS.length);
      }, 12_000);
    } else {
      setIdleIndex(0);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // Determine which config to show
  let cfg;
  if (status === 'running' && currentStep && STEP_CONFIG[currentStep]) {
    cfg = STEP_CONFIG[currentStep];
  } else if (status === 'paused') {
    cfg = { emoji: '🤔', label: 'Waiting to continue…', animation: 'animate-thinking' };
  } else if (status === 'idle') {
    cfg = IDLE_ANTICS[idleIndex];
  } else {
    cfg = { emoji: STATUS_CONFIG[status]?.emoji ?? '💻', label: STATUS_CONFIG[status]?.label ?? '', animation: '' };
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <StatusRing status={status}>
        <DeskScene emoji={cfg.emoji} animation={cfg.animation} />
      </StatusRing>

      {/* Mood label */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground italic transition-all duration-500">
          {cfg.label}
        </p>
      </div>

      {/* CSS animation keyframes */}
      <style>{`
        .animate-sleeping {
          animation: sleeping 3s ease-in-out infinite;
        }
        @keyframes sleeping {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(4px) rotate(-5deg); }
        }

        .animate-reading {
          animation: reading 4s ease-in-out infinite;
        }
        @keyframes reading {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg) translateX(-3px); }
          75% { transform: rotate(3deg) translateX(3px); }
        }

        .animate-doodling {
          animation: doodling 0.4s ease-in-out infinite alternate;
        }
        @keyframes doodling {
          0% { transform: translateX(-2px) translateY(-1px); }
          100% { transform: translateX(2px) translateY(1px); }
        }

        .animate-dancing {
          animation: dancing 0.6s ease-in-out infinite alternate;
        }
        @keyframes dancing {
          0% { transform: translateY(0) rotate(-8deg) scale(1); }
          100% { transform: translateY(-6px) rotate(8deg) scale(1.05); }
        }

        .animate-staring {
          animation: staring 5s ease-in-out infinite;
        }
        @keyframes staring {
          0%, 90%, 100% { opacity: 1; }
          92%, 96% { opacity: 0.2; }
        }

        .animate-coffee {
          animation: coffee 2s ease-in-out infinite;
        }
        @keyframes coffee {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg) translateY(-4px); }
        }

        .animate-gaming {
          animation: gaming 0.15s ease-in-out infinite alternate;
        }
        @keyframes gaming {
          0% { transform: translateX(-1px) rotate(-2deg); }
          100% { transform: translateX(1px) rotate(2deg); }
        }

        .animate-watering {
          animation: watering 1.5s ease-in-out infinite;
        }
        @keyframes watering {
          0%, 100% { transform: rotate(0deg); }
          30%, 70% { transform: rotate(-15deg) translateY(-3px); }
        }

        .animate-researching {
          animation: researching 1.2s ease-in-out infinite;
        }
        @keyframes researching {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08) rotate(5deg); }
        }

        .animate-writing {
          animation: writing 0.5s ease-in-out infinite alternate;
        }
        @keyframes writing {
          0% { transform: translateX(-3px) translateY(-1px) rotate(-5deg); }
          100% { transform: translateX(3px) translateY(1px) rotate(5deg); }
        }

        .animate-assets {
          animation: assets 1.8s ease-in-out infinite;
        }
        @keyframes assets {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-10deg) scale(1.05); }
          75% { transform: rotate(10deg) scale(1.05); }
          100% { transform: rotate(0deg) scale(1); }
        }

        .animate-thinking {
          animation: thinking 3s ease-in-out infinite;
        }
        @keyframes thinking {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-3px) rotate(-4deg); }
          66% { transform: translateY(-3px) rotate(4deg); }
        }
      `}</style>
    </div>
  );
}
