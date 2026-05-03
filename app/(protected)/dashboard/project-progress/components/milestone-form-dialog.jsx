'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { ProjectMilestoneSchema } from '@/app/(protected)/dashboard/project-progress/forms/milestone-schema';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function MilestoneFormDialog({ open, onOpenChange, milestone, workstream }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(milestone?.id);
  const form = useForm({
    resolver: zodResolver(ProjectMilestoneSchema),
    defaultValues: {
      workstreamId: workstream?.id || '',
      title: '',
      description: '',
      status: 'not_started',
      type: workstream?.phase?.slug === 'build' ? 'build' : 'automation',
      startDate: '',
      endDate: '',
      progressPercent: 0,
      sortOrder: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      workstreamId: milestone?.workstreamId || workstream?.id || '',
      title: milestone?.title || '',
      description: milestone?.description || '',
      status: milestone?.status || 'not_started',
      type: milestone?.type || (workstream?.phase?.slug === 'build' ? 'build' : 'automation'),
      startDate: milestone?.startDate ? String(milestone.startDate).slice(0, 10) : '',
      endDate: milestone?.endDate ? String(milestone.endDate).slice(0, 10) : '',
      progressPercent: milestone?.progressPercent ?? 0,
      sortOrder: milestone?.sortOrder ?? 0,
    });
  }, [open, form, milestone, workstream]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      const endpoint = isEdit
        ? `/api/project-progress/milestones/${milestone.id}`
        : '/api/project-progress/milestones';
      const response = await apiFetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.message || 'Request failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-progress'] });
      toast.success(isEdit ? 'Milestone updated' : 'Milestone created');
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit milestone' : 'Add milestone'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={values.title} onChange={(e) => form.setValue('title', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={values.description || ''} onChange={(e) => form.setValue('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={values.status} onValueChange={(v) => form.setValue('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not started</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={values.type} onValueChange={(v) => form.setValue('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="build">Build</SelectItem>
                  <SelectItem value="automation">Automation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input type="date" value={values.startDate || ''} onChange={(e) => form.setValue('startDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End date</Label>
              <Input type="date" value={values.endDate || ''} onChange={(e) => form.setValue('endDate', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Progress ({values.progressPercent}%)</Label>
            <Input
              type="range"
              min="0"
              max="100"
              value={values.progressPercent}
              onChange={(e) => form.setValue('progressPercent', Number(e.target.value))}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit((value) => mutation.mutate(value))} disabled={mutation.isPending}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

