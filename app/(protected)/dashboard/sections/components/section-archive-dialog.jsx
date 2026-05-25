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
  AlertDialogAction,
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
 * @param {null | { id: string; name: string; categoryCount?: number }} props.section
 * @param {boolean} [props.redirectAfter]
 */
export function SectionArchiveDialog({
  open,
  onOpenChange,
  section,
  redirectAfter = false,
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!section?.id) throw new Error('No section');
      const response = await apiFetch(`/api/sections/${section.id}`, {
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
        (d?.result === 'deleted' ? 'Section removed.' : 'Section archived.');
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
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onOpenChange(false);
      if (redirectAfter) {
        router.push('/dashboard/sections');
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
  const categories = section?.categoryCount ?? 0;
  const hasDeps = categories > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasDeps ? 'Archive section?' : 'Delete section?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {section
              ? hasDeps
                ? `"${section.name}" has ${categories} categor${categories === 1 ? 'y' : 'ies'}. It will be archived instead of permanently deleted.`
                : `"${section.name}" will be permanently deleted. This cannot be undone.`
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
            disabled={isProcessing || !section}
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
