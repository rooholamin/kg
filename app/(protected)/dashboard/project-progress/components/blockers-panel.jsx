'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BlockerFormDialog } from './blocker-form-dialog';

function severityVariant(severity) {
  if (severity === 'critical' || severity === 'high') return 'destructive';
  if (severity === 'medium') return 'secondary';
  return 'outline';
}

export function BlockersPanel({ blockers, phases, isAdmin }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const milestones = useMemo(
    () =>
      phases.flatMap((phase) =>
        phase.workstreams.flatMap((ws) =>
          ws.milestones.map((ms) => ({ ...ms, workstreamName: ws.name })),
        ),
      ),
    [phases],
  );

  const resolveMutation = useMutation({
    mutationFn: async (blocker) => {
      const response = await apiFetch(`/api/project-progress/blockers/${blocker.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: blocker.status === 'open' ? 'resolved' : 'open' }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.message || 'Failed to update blocker');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-progress'] }),
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiFetch(`/api/project-progress/blockers/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.message || 'Failed to delete blocker');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-progress'] }),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="flex items-center justify-between gap-3 text-[1.15rem] leading-none">
          <span>Blockers</span>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs font-medium rounded-md"
              onClick={() => setCreating(true)}
            >
              Add blocker
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {blockers.map((blocker) => {
          const isAutomation = blocker?.milestone?.type === 'automation';
          return (
            <div
              key={blocker.id}
              className={`rounded-md border p-3 ${isAutomation ? 'border-primary/40 border-l-4' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{blocker.title}</p>
                  <p className="text-xs text-muted-foreground">{blocker.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={severityVariant(blocker.severity)}>{blocker.severity}</Badge>
                    <Badge variant="outline">{blocker.status}</Badge>
                    {isAutomation && <Badge>Automation blocker</Badge>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => resolveMutation.mutate(blocker)}>
                      {blocker.status === 'open' ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <AlertCircle className="size-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(blocker)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(blocker.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
      {(creating || editing) && (
        <BlockerFormDialog
          open={creating || Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) {
              setCreating(false);
              setEditing(null);
            }
          }}
          blocker={editing}
          milestones={milestones}
        />
      )}
    </Card>
  );
}

