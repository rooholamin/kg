'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircleIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TopicFormSchema } from '../forms/topic-schema';

async function fetchCategories() {
  const response = await apiFetch('/api/categories');
  if (!response.ok) {
    const j = await response.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load categories');
  }
  return response.json();
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onOpenChange
 * @param {null | { id: string; name: string; description?: string | null; categoryId: string; targetKeyword?: string | null; status: string }} props.topic
 */
export function TopicFormDialog({ open, onOpenChange, topic }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const isEdit = Boolean(topic?.id);

  const { data: catJson, isError: catError, error: catErr } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: open,
  });
  const categories = catJson?.data ?? [];

  const form = useForm({
    resolver: zodResolver(TopicFormSchema),
    defaultValues: {
      name: '',
      description: '',
      categoryId: '',
      targetKeyword: '',
      status: 'active',
    },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      form.reset({
        name: topic.name,
        description: topic.description ?? '',
        categoryId: topic.categoryId,
        targetKeyword: topic.targetKeyword ?? '',
        status: topic.status === 'archived' ? 'archived' : 'active',
      });
    } else {
      form.reset({
        name: '',
        description: '',
        categoryId: '',
        targetKeyword: '',
        status: 'active',
      });
    }
  }, [open, isEdit, topic, form]);

  useEffect(() => {
    if (!open || isEdit) return;
    if (categories.length > 0 && !form.getValues('categoryId')) {
      form.setValue('categoryId', categories[0].id, { shouldDirty: false });
    }
  }, [open, isEdit, categories, form]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      const url = isEdit ? `/api/topics/${topic.id}` : '/api/topics';
      const response = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
          categoryId: values.categoryId,
          targetKeyword: values.targetKeyword || null,
          status: values.status,
        }),
      });
      if (!response.ok) {
        const j = await response.json().catch(() => ({}));
        throw new Error(j.message || 'Request failed');
      }
      return response.json();
    },
    onSuccess: () => {
      const message = isEdit
        ? 'Topic updated successfully'
        : 'Topic created successfully';
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
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      router.refresh();
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit topic' : 'Create topic'}</DialogTitle>
        </DialogHeader>
        {catError && (
          <p className="text-sm text-destructive">{catErr?.message}</p>
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <DialogBody className="pt-2.5 space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Smart Thermostats" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Short summary…"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetKeyword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target keyword</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. smart thermostat tips"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">active</SelectItem>
                        <SelectItem value="archived">archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !form.formState.isDirty ||
                  isProcessing ||
                  (!isEdit && categories.length === 0) ||
                  !form.getValues('categoryId')
                }
              >
                {isProcessing && (
                  <LoaderCircleIcon className="me-1 size-4 animate-spin" />
                )}
                {isEdit ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
