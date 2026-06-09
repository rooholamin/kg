'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { Lightbulb, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const PRIORITY_OPTIONS = ['all', 'low', 'medium', 'high'];
const STATUS_OPTIONS = ['all', 'new', 'under_consideration', 'accepted', 'rejected', 'parked'];

function useIsAdmin() {
  const { data } = useSession();
  const slug = data?.user?.roleSlug;
  return slug === 'superadmin' || slug === 'admin';
}

function priorityVariant(priority) {
  if (priority === 'high') return 'destructive';
  if (priority === 'medium') return 'warning';
  return 'outline';
}

function statusVariant(status) {
  if (status === 'accepted') return 'success';
  if (status === 'rejected') return 'destructive';
  if (status === 'under_consideration') return 'warning';
  if (status === 'new') return 'primary';
  return 'secondary';
}

function statusLabel(value) {
  return String(value || '').replace(/_/g, ' ');
}

async function fetchIdeas(status, priority) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (priority && priority !== 'all') params.set('priority', priority);
  const response = await apiFetch(`/api/idea-backlog?${params.toString()}`);
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.message || 'Failed to load ideas');
  }
  return response.json();
}

function IdeaFormDialog({ open, onOpenChange, idea }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(idea?.id);
  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      status: 'new',
      tagsInput: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: idea?.title || '',
      description: idea?.description || '',
      priority: idea?.priority || 'medium',
      status: idea?.status || 'new',
      tagsInput: Array.isArray(idea?.tags) ? idea.tags.join(', ') : '',
    });
  }, [open, idea, form]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        title: values.title,
        description: values.description || null,
        priority: values.priority,
        status: values.status,
        tags: String(values.tagsInput || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      const endpoint = isEdit ? `/api/idea-backlog/${idea.id}` : '/api/idea-backlog';
      const response = await apiFetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.message || 'Request failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idea-backlog'] });
      toast.success(isEdit ? 'Idea updated' : 'Idea created');
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit idea' : 'New idea'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={values.title} onChange={(e) => form.setValue('title', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={values.description}
              onChange={(e) => form.setValue('description', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={values.priority} onValueChange={(v) => form.setValue('priority', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
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
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="under_consideration">Under consideration</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="parked">Parked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Tags (comma-separated)</Label>
            <Input
              value={values.tagsInput}
              onChange={(e) => form.setValue('tagsInput', e.target.value)}
              placeholder="automation, seo, workflow"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit((formValues) => mutation.mutate(formValues))}
            disabled={mutation.isPending}
          >
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IdeaBacklogContent({ initialData }) {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [dialogState, setDialogState] = useState({ open: false, idea: null });
  const [deleteIdea, setDeleteIdea] = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['idea-backlog', status, priority],
    queryFn: () => fetchIdeas(status, priority),
    initialData: status === 'all' && priority === 'all' ? { data: initialData || [] } : undefined,
  });

  const ideas = useMemo(() => data?.data || [], [data]);

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiFetch(`/api/idea-backlog/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.message || 'Failed to delete idea');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idea-backlog'] });
      toast.success('Idea deleted');
      setDeleteIdea(null);
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) return <p className="text-sm text-destructive">{error.message}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="w-full sm:w-48">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === 'all' ? 'All statuses' : statusLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-44">
            <Label className="text-xs">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === 'all' ? 'All priorities' : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setDialogState({ open: true, idea: null })}>
            New idea
          </Button>
        )}
      </div>

      {ideas.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <Lightbulb className="size-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No ideas yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ideas.map((idea) => (
            <Card key={idea.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-3 text-base">
                  <span>{idea.title}</span>
                  {isAdmin && (
                    <span className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDialogState({ open: true, idea })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteIdea(idea)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {idea.description || 'No description.'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={priorityVariant(idea.priority)} appearance="light">
                    {idea.priority}
                  </Badge>
                  <Badge variant={statusVariant(idea.status)} appearance="light">
                    {statusLabel(idea.status)}
                  </Badge>
                </div>
                {idea.tags?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {idea.tags.map((tag) => (
                      <Badge key={`${idea.id}-${tag}`} variant="outline" appearance="light">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Added {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isAdmin && dialogState.open && (
        <IdeaFormDialog
          open={dialogState.open}
          idea={dialogState.idea}
          onOpenChange={(open) => {
            if (!open) setDialogState({ open: false, idea: null });
          }}
        />
      )}

      <AlertDialog open={Boolean(deleteIdea)} onOpenChange={(open) => !open && setDeleteIdea(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete idea?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this idea from the backlog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteMutation.mutate(deleteIdea.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
