'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { ProjectWorkstreamSchema } from '@/app/(protected)/dashboard/project-progress/forms/workstream-schema';
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

export function WorkstreamFormDialog({ open, onOpenChange, phases }) {
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(ProjectWorkstreamSchema),
    defaultValues: {
      phaseId: phases[0]?.id || '',
      name: '',
      description: '',
      sortOrder: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      phaseId: phases[0]?.id || '',
      name: '',
      description: '',
      sortOrder: 0,
    });
  }, [open, phases, form]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      const response = await apiFetch('/api/project-progress/workstreams', {
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
      toast.success('Workstream created');
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New workstream</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-1">
            <Label>Phase</Label>
            <Select value={values.phaseId} onValueChange={(v) => form.setValue('phaseId', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {phases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={values.name} onChange={(e) => form.setValue('name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={values.description || ''} onChange={(e) => form.setValue('description', e.target.value)} />
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

