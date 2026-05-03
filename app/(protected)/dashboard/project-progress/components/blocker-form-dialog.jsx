'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { ProjectBlockerSchema } from '@/app/(protected)/dashboard/project-progress/forms/blocker-schema';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function BlockerFormDialog({ open, onOpenChange, blocker, milestones }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(blocker?.id);
  const form = useForm({
    resolver: zodResolver(ProjectBlockerSchema),
    defaultValues: {
      milestoneId: null,
      title: '',
      description: '',
      severity: 'medium',
      status: 'open',
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      milestoneId: blocker?.milestoneId || null,
      title: blocker?.title || '',
      description: blocker?.description || '',
      severity: blocker?.severity || 'medium',
      status: blocker?.status || 'open',
    });
  }, [open, blocker, form]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      const endpoint = isEdit
        ? `/api/project-progress/blockers/${blocker.id}`
        : '/api/project-progress/blockers';
      const response = await apiFetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.message || 'Request failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-progress'] });
      toast.success(isEdit ? 'Blocker updated' : 'Blocker created');
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit blocker' : 'Add blocker'}</DialogTitle>
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
          <div className="space-y-1">
            <Label>Milestone (optional)</Label>
            <Select value={values.milestoneId || 'none'} onValueChange={(v) => form.setValue('milestoneId', v === 'none' ? null : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General blocker</SelectItem>
                {milestones.map((ms) => (
                  <SelectItem key={ms.id} value={ms.id}>
                    {ms.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Severity</Label>
              <Select value={values.severity} onValueChange={(v) => form.setValue('severity', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={values.status} onValueChange={(v) => form.setValue('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

