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
import { CategoryFormSchema } from '../forms/category-schema';

async function fetchSections() {
  const res = await apiFetch('/api/sections');
  if (!res.ok) return { data: [] };
  return res.json();
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onOpenChange
 * @param {null | { id: string; name: string; description?: string | null; status: string; sectionId?: string | null }} props.category
 */
export function CategoryFormDialog({ open, onOpenChange, category }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const isEdit = Boolean(category?.id);

  const { data: sectionsData } = useQuery({
    queryKey: ['sections'],
    queryFn: fetchSections,
    enabled: open,
  });
  const sections = sectionsData?.data ?? [];

  const form = useForm({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'active',
      sectionId: '',
    },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      form.reset({
        name: category.name,
        description: category.description ?? '',
        status: category.status === 'archived' ? 'archived' : 'active',
        sectionId: category.sectionId ?? '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
        status: 'active',
        sectionId: '',
      });
    }
  }, [open, isEdit, category, form]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      const url = isEdit
        ? `/api/categories/${category.id}`
        : '/api/categories';
      const response = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
          status: values.status,
          sectionId: values.sectionId || null,
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
        ? 'Category updated successfully'
        : 'Category created successfully';
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
          <DialogTitle>
            {isEdit ? 'Edit category' : 'Create category'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <DialogBody className="pt-2.5 space-y-6">
              <FormField
                control={form.control}
                name="sectionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a section…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. HVAC Maintenance" {...field} />
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
                disabled={!form.formState.isDirty || isProcessing}
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
