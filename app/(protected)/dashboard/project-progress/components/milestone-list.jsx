'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { MilestoneArchiveDialog } from './milestone-archive-dialog';
import { MilestoneFormDialog } from './milestone-form-dialog';

function flattenMilestones(phases) {
  return phases.flatMap((phase) =>
    phase.workstreams.flatMap((ws) =>
      ws.milestones.map((ms) => ({
        ...ms,
        workstreamName: ws.name,
        phaseSlug: phase.slug,
      })),
    ),
  );
}

export function MilestoneList({ phases, isAdmin }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const milestones = useMemo(() => flattenMilestones(phases), [phases]);

  const quickUpdate = useMutation({
    mutationFn: async ({ id, patch }) => {
      const response = await apiFetch(`/api/project-progress/milestones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.message || 'Update failed');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-progress'] }),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-[1.15rem] leading-none">Milestones</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Workstream</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestones.map((ms) => (
              <TableRow key={ms.id}>
                <TableCell>{ms.title}</TableCell>
                <TableCell>{ms.workstreamName}</TableCell>
                <TableCell>
                  <Badge variant={ms.type === 'automation' ? 'default' : 'secondary'}>
                    {ms.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Select
                      value={ms.status}
                      onValueChange={(value) =>
                        quickUpdate.mutate({ id: ms.id, patch: { status: value } })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not started</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{ms.status.replace('_', ' ')}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Input
                      type="number"
                      className="w-20"
                      min={0}
                      max={100}
                      defaultValue={ms.progressPercent}
                      onBlur={(event) =>
                        quickUpdate.mutate({
                          id: ms.id,
                          patch: { progressPercent: Number(event.target.value) },
                        })
                      }
                    />
                  ) : (
                    <span>{ms.progressPercent}%</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-xs text-muted-foreground">
                    <p>{ms.startDate ? String(ms.startDate).slice(0, 10) : '—'}</p>
                    <p>{ms.endDate ? String(ms.endDate).slice(0, 10) : '—'}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin && (
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(ms)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(ms)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {editing && (
        <MilestoneFormDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          milestone={editing}
          workstream={null}
        />
      )}
      {deleting && (
        <MilestoneArchiveDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          milestone={deleting}
        />
      )}
    </Card>
  );
}

