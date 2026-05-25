'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { SectionFormSchema } from '../forms/section-schema';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onOpenChange
 * @param {null | object} props.section
 */
export function SectionFormDialog({ open, onOpenChange, section }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const isEdit = Boolean(section?.id);

  const form = useForm({
    resolver: zodResolver(SectionFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      summary: '',
      icon: '',
      status: 'active',
      characterName: '',
      characterBiography: '',
      characterPersona: '',
      characterImage: '',
    },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      form.reset({
        name: section.name ?? '',
        slug: section.slug ?? '',
        description: section.description ?? '',
        summary: section.summary ?? '',
        icon: section.icon ?? '',
        status: section.status === 'archived' ? 'archived' : 'active',
        characterName: section.characterName ?? '',
        characterBiography: section.characterBiography ?? '',
        characterPersona: section.characterPersona ?? '',
        characterImage: section.characterImage ?? '',
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        description: '',
        summary: '',
        icon: '',
        status: 'active',
        characterName: '',
        characterBiography: '',
        characterPersona: '',
        characterImage: '',
      });
    }
  }, [open, isEdit, section, form]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      const url = isEdit ? `/api/sections/${section.id}` : '/api/sections';
      const response = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          slug: values.slug || null,
          description: values.description || null,
          summary: values.summary || null,
          icon: values.icon || null,
          status: values.status,
          characterName: values.characterName,
          characterBiography: values.characterBiography || null,
          characterPersona: values.characterPersona || null,
          characterImage: values.characterImage || null,
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
        ? 'Section updated successfully'
        : 'Section created successfully';
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit section' : 'Create section'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <DialogBody className="pt-2.5 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. KG Build" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug (auto-generated if blank)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. kg-build"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Full description of this section…"
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
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Summary</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Short one-line summary…"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Hammer"
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
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  Character / Persona
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="characterName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Character name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Rex" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="characterImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Character image URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="/media/characters/rex.png"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="characterBiography"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Biography</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="Character background story…"
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
                    name="characterPersona"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Persona</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="Tone, voice, and communication style…"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
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
