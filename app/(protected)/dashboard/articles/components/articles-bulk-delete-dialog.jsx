'use client';

import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircleIcon } from 'lucide-react';
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
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string[]} props.ids - article IDs to delete
 * @param {() => void} props.onSuccess - called after successful deletion
 */
export function ArticlesBulkDeleteDialog({ open, onOpenChange, ids = [], onSuccess }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch('/api/articles/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        const j = await response.json().catch(() => ({}));
        throw new Error(j.message || 'Request failed');
      }
      return response.json();
    },
    onSuccess: (json) => {
      const { deleted, failed } = json.data ?? {};
      const msg =
        failed > 0
          ? `${deleted} article${deleted !== 1 ? 's' : ''} deleted, ${failed} failed.`
          : `${deleted} article${deleted !== 1 ? 's' : ''} deleted.`;
      toast.custom(
        () => (
          <Alert variant="mono" icon="success" close={false}>
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>{msg}</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      onOpenChange(false);
      onSuccess?.();
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
  const count = ids.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} article{count !== 1 ? 's' : ''} permanently?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {count} article{count !== 1 ? 's' : ''} will be permanently removed. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" type="button" disabled={isProcessing}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isProcessing || count === 0}
            onClick={() => mutation.mutate()}
          >
            {isProcessing && (
              <LoaderCircleIcon className="me-1 size-4 animate-spin" />
            )}
            Delete {count > 1 ? `${count} articles` : 'article'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
