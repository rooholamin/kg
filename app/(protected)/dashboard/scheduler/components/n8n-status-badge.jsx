'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

async function fetchN8nStatus() {
  const res = await apiFetch('/api/scheduler/n8n-status');
  if (!res.ok) return { available: false, error: 'Request failed' };
  return res.json();
}

/**
 * Polls /api/scheduler/n8n-status every 30 s and shows connection state.
 * Passes `available` boolean to `onStatusChange` for parent button gating.
 * @param {{ onStatusChange?: (available: boolean) => void; className?: string }} props
 */
export function N8nStatusBadge({ onStatusChange, className }) {
  const { data, isLoading } = useQuery({
    queryKey: ['n8n-status'],
    queryFn: fetchN8nStatus,
    refetchInterval: 30_000,
  });

  const available = data?.available ?? false;

  useEffect(() => {
    onStatusChange?.(available);
  }, [available, onStatusChange]);

  const latency = data?.latency;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
        isLoading
          ? 'border-border text-muted-foreground bg-muted/50'
          : available
            ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
            : 'border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/10',
        className,
      )}
    >
      {isLoading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span
          className={cn(
            'size-2 rounded-full',
            available ? 'bg-emerald-500' : 'bg-rose-500',
          )}
        />
      )}
      {isLoading
        ? 'Checking AI Agent…'
        : available
          ? `AI Agent Connected${latency ? ` · ${latency}ms` : ''}`
          : `AI Agent Offline${data?.error ? ` — ${data.error}` : ''}`}
    </div>
  );
}
