'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '../components/user-context';

const EVENT_VARIANT = {
  create: 'success',
  update: 'primary',
  trash: 'destructive',
  delete: 'destructive',
  restore: 'warning',
  login: 'secondary',
};

function fmtDate(v) {
  try {
    return format(typeof v === 'string' ? parseISO(v) : new Date(v), 'PP · p');
  } catch {
    return '—';
  }
}

export default function UserLogsPage({ params }) {
  const { id } = use(params);
  const { isLoading: userLoading } = useUser();

  const { data, isLoading } = useQuery({
    queryKey: ['user-logs', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/user-management/users/${id}/logs?limit=50`);
      if (!res.ok) throw new Error('Failed to load logs');
      return res.json();
    },
    enabled: !userLoading,
  });

  const logs = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!logs.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No activity recorded for this user yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card key={log.id}>
          <CardContent className="py-3 flex items-start gap-4">
            <div className="pt-0.5">
              <Badge
                variant={EVENT_VARIANT[log.event] ?? 'secondary'}
                appearance="light"
                className="capitalize text-xs"
              >
                {log.event ?? '—'}
              </Badge>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">
                {log.description || log.entityType || '—'}
              </p>
              {log.entityType && log.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{log.entityType}</p>
              )}
            </div>
            <div className="shrink-0 text-xs text-muted-foreground text-right">
              <p>{fmtDate(log.createdAt)}</p>
              {log.ipAddress && (
                <p className="mt-0.5 font-mono">{log.ipAddress}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {data?.pagination?.total > 50 && (
        <p className="text-xs text-center text-muted-foreground pt-2">
          Showing 50 of {data.pagination.total} entries.
        </p>
      )}
    </div>
  );
}
