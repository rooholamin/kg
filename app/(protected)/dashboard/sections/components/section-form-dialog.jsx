'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircleIcon, UploadIcon, UserCircle2Icon, XIcon } from 'lucide-react';
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

const EMPTY_DEFAULTS = {
  name: '',
  slug: '',
  description: '',
  summary: '',
  icon: '',
  status: 'active',
  characterName: '',
  characterBackground: '',
  characterRole: '',
  characterAge: '',
  characterBiography: '',
  characterTone: '',
  characterWritingStyle: '',
  characterSampleVoice: '',
  characterPersona: '',
  characterImage: '',
  wpSiteUrl: '',
  wpUsername: '',
  wpAppPassword: '',
  wpAuthorId: '',
};

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
  const fileInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const form = useForm({
    resolver: zodResolver(SectionFormSchema),
    defaultValues: EMPTY_DEFAULTS,
    mode: 'onSubmit',
  });

  const watchedImage = form.watch('characterImage');

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
        characterBackground: section.characterBackground ?? '',
        characterRole: section.characterRole ?? '',
        characterAge: section.characterAge ?? '',
        characterBiography: section.characterBiography ?? '',
        characterTone: section.characterTone ?? '',
        characterWritingStyle: section.characterWritingStyle ?? '',
        characterSampleVoice: section.characterSampleVoice ?? '',
        characterPersona: section.characterPersona ?? '',
        characterImage: section.characterImage ?? '',
        wpSiteUrl: section.wpSiteUrl ?? '',
        wpUsername: section.wpUsername ?? '',
        wpAppPassword: section.wpAppPassword ?? '',
        wpAuthorId: section.wpAuthorId ?? '',
      });
      setAvatarPreview(section.characterImage || null);
    } else {
      form.reset(EMPTY_DEFAULTS);
      setAvatarPreview(null);
    }
  }, [open, isEdit, section, form]);

  async function handleAvatarFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('directory', 'characters');
      const res = await fetch('/api/uploads', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Upload failed');
      }
      const { data } = await res.json();
      form.setValue('characterImage', data.url, { shouldDirty: true });
      setAvatarPreview(data.url);
    } catch (err) {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive" close={false}>
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{err.message}</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemoveAvatar() {
    form.setValue('characterImage', '', { shouldDirty: true });
    setAvatarPreview(null);
  }

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
          characterBackground: values.characterBackground || null,
          characterRole: values.characterRole || null,
          characterAge: values.characterAge || null,
          characterBiography: values.characterBiography || null,
          characterTone: values.characterTone || null,
          characterWritingStyle: values.characterWritingStyle || null,
          characterSampleVoice: values.characterSampleVoice || null,
          characterPersona: values.characterPersona || null,
          characterImage: values.characterImage || null,
          wpSiteUrl: values.wpSiteUrl || null,
          wpUsername: values.wpUsername || null,
          wpAppPassword: values.wpAppPassword || null,
          wpAuthorId: values.wpAuthorId ? Number(values.wpAuthorId) : null,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              {/* ── Section basics ── */}
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

              {/* ── Character / Persona ── */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-foreground mb-4">
                  Character &amp; Persona
                </p>
                <div className="space-y-4">

                  {/* Avatar upload */}
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      {avatarPreview || watchedImage ? (
                        <div className="relative size-20 rounded-lg overflow-hidden border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={avatarPreview || watchedImage}
                            alt="Character avatar"
                            className="size-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white p-0.5 hover:bg-black/80"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="size-20 rounded-lg border border-dashed flex items-center justify-center bg-muted/30">
                          <UserCircle2Icon className="size-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-foreground">Avatar</p>
                      <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP. Max 10 MB.</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={avatarUploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {avatarUploading ? (
                          <LoaderCircleIcon className="me-1.5 size-3.5 animate-spin" />
                        ) : (
                          <UploadIcon className="me-1.5 size-3.5" />
                        )}
                        {avatarUploading ? 'Uploading…' : 'Upload avatar'}
                      </Button>
                    </div>
                  </div>

                  {/* Name + Age */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="characterName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Livia Moretti" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="characterAge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Early 30s"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Background + Role */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="characterBackground"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Background</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Canadian"
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
                      name="characterRole"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Lifestyle and wellness writer"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Biography */}
                  <FormField
                    control={form.control}
                    name="characterBiography"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Biography</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={4}
                            placeholder="Character background story…"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tone */}
                  <FormField
                    control={form.control}
                    name="characterTone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Warm, polished, human, optimistic, lifestyle focused."
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Writing style */}
                  <FormField
                    control={form.control}
                    name="characterWritingStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Writing style / topics</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="What does this character write about and how?…"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Sample voice */}
                  <FormField
                    control={form.control}
                    name="characterSampleVoice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sample voice</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="A short quote that captures the character's voice…"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Persona (AI prompt guidance) */}
                  <FormField
                    control={form.control}
                    name="characterPersona"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Persona (AI prompt guidance)</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="Concise AI-facing persona description used in generation prompts…"
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

              {/* ── WordPress integration ── */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-foreground mb-1">
                  WordPress Integration
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Credentials for publishing articles from this section. Use an{' '}
                  <a
                    href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Application Password
                  </a>
                  {' '}(not your login password).
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="wpSiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WordPress site URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://myblog.com"
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
                      name="wpUsername"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WordPress username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="wp-username"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="wpAppPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Application password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                              autoComplete="new-password"
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
                      name="wpAuthorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WP Author ID</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="e.g. 2"
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
