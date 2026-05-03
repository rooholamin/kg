'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { ProjectProgressReportSchema } from '@/app/(protected)/dashboard/project-progress/forms/report-schema';
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

export function ReportFormDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(ProjectProgressReportSchema),
    defaultValues: {
      title: '',
      summary: '',
      buildProgress: undefined,
      automationProgress: undefined,
      keyFocus: '',
      blockersSummary: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: '',
      summary: '',
      buildProgress: undefined,
      automationProgress: undefined,
      keyFocus: '',
      blockersSummary: '',
    });
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      const response = await apiFetch('/api/project-progress/reports', {
        method: 'POST',
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
      toast.success('Report created');
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New progress report</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={values.title} onChange={(e) => form.setValue('title', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Summary</Label>
            <Textarea rows={4} value={values.summary} onChange={(e) => form.setValue('summary', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Build progress (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={values.buildProgress ?? ''}
                onChange={(e) =>
                  form.setValue(
                    'buildProgress',
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Automation progress (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={values.automationProgress ?? ''}
                onChange={(e) =>
                  form.setValue(
                    'automationProgress',
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Current focus</Label>
            <Input value={values.keyFocus || ''} onChange={(e) => form.setValue('keyFocus', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Blocker summary</Label>
            <Textarea value={values.blockersSummary || ''} onChange={(e) => form.setValue('blockersSummary', e.target.value)} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit((value) => mutation.mutate(value))} disabled={mutation.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

