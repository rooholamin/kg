'use client';

import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircleIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onOpenChange
 * @param {null | { id: string; name: string; articleCount?: number }} props.topic
 * @param {boolean} [props.redirectAfter]
 */
export function TopicArchiveDialog({
  open,
  onOpenChange,
  topic,
  redirectAfter = false,
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!topic?.id) throw new Error('No topic');
      const response = await apiFetch(`/api/topics/${topic.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const j = await response.json().catch(() => ({}));
        throw new Error(j.message || 'Request failed');
      }
      return response.json();
    },
    onSuccess: (json) => {
      const d = json.data;
      const message =
        d?.message ||
        (d?.result === 'deleted' ? 'Topic removed.' : 'Topic archived.');
      toast.custom(
        () => (
          <Alert variant="mono" icon="success" close={false}>
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      onOpenChange(false);
      if (redirectAfter) {
        router.push('/dashboard/topics');
      }
      router.refresh();
    },
    onError: (error) => {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive" close={false}>
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{error.message}</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
    },
  });

  const isProcessing = mutation.status === 'pending';
  const articles = topic?.articleCount ?? 0;
  const hasDeps = articles > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasDeps ? 'Archive topic?' : 'Delete topic?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {topic
              ? hasDeps
                ? `"${topic.name}" has ${articles} article(s). It will be archived instead of permanently deleted.`
                : `"${topic.name}" will be permanently deleted. This cannot be undone.`
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isProcessing || !topic}
            onClick={() => mutation.mutate()}
          >
            {isProcessing && (
              <LoaderCircleIcon className="me-1 size-4 animate-spin" />
            )}
            {hasDeps ? 'Archive' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
