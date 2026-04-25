'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO } from 'date-fns';
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
import { Switch } from '@/components/ui/switch';
import { PIPELINE_STAGES } from '@/app/(protected)/dashboard/_mock';
import { ImageUploadInput } from '@/components/custom/image-upload-input';
import { GalleryUploadInput } from '@/components/custom/gallery-upload-input';
import { RichTextEditor } from '@/components/custom/rich-text-editor';
import { ArticleFormSchema } from '../forms/article-schema';
import { cn } from '@/lib/utils';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

function toDateInput(v) {
  if (!v) return '';
  try {
    const d = typeof v === 'string' ? parseISO(v) : v;
    return format(d, 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

async function fetchTopics() {
  const response = await apiFetch('/api/topics?categoryId=all');
  if (!response.ok) {
    const j = await response.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load topics');
  }
  return response.json();
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onOpenChange
 * @param {null | object} props.article
 */
export function ArticleFormDialog({ open, onOpenChange, article }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const isEdit = Boolean(article?.id);

  const { data: topJson, isError: topError, error: topErr } = useQuery({
    queryKey: ['topics', 'all'],
    queryFn: fetchTopics,
    enabled: open,
  });
  const topics = topJson?.data ?? [];

  const form = useForm({
    resolver: zodResolver(ArticleFormSchema),
    defaultValues: {
      title: '',
      summary: '',
      topicId: '',
      categoryId: '',
      status: 'planning',
      publishDate: '',
      featuredImage: null,
      videoUrl: null,
      isEditorsChoice: false,
      content: emptyDoc,
      galleryImages: [],
    },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      form.reset({
        title: article.title,
        summary: article.summary ?? '',
        topicId: article.topicId,
        categoryId: article.categoryId,
        status: article.status,
        publishDate: toDateInput(article.publishDate) || '',
        featuredImage: article.featuredImage || null,
        videoUrl: article.videoUrl || null,
        isEditorsChoice: Boolean(article.isEditorsChoice),
        content: article.content && article.content.type === 'doc' ? article.content : emptyDoc,
        galleryImages: Array.isArray(article.galleryImages) ? article.galleryImages : [],
      });
    } else {
      form.reset({
        title: '',
        summary: '',
        topicId: '',
        categoryId: '',
        status: 'planning',
        publishDate: '',
        featuredImage: null,
        videoUrl: null,
        isEditorsChoice: false,
        content: emptyDoc,
        galleryImages: [],
      });
    }
  }, [open, isEdit, article, form]);

  useEffect(() => {
    if (!open || isEdit) return;
    if (topics.length > 0 && !form.getValues('topicId')) {
      const first = topics[0];
      form.setValue('topicId', first.id, { shouldDirty: false });
      form.setValue('categoryId', first.categoryId, { shouldDirty: false });
    }
  }, [open, isEdit, topics, form]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      const url = isEdit ? `/api/articles/${article.id}` : '/api/articles';
      const response = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title,
          summary: values.summary || null,
          topicId: values.topicId,
          categoryId: values.categoryId,
          status: values.status,
          publishDate: values.publishDate || null,
          featuredImage: values.featuredImage || null,
          videoUrl: values.videoUrl || null,
          isEditorsChoice: values.isEditorsChoice,
          content: values.content,
          galleryImages: values.galleryImages || [],
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
        ? 'Article updated successfully'
        : 'Article created successfully';
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
      queryClient.invalidateQueries({ queryKey: ['articles'] });
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
  const topicIdWatch = form.watch('topicId');

  const onTopicChange = (id) => {
    const t = topics.find((x) => x.id === id);
    if (t) {
      form.setValue('categoryId', t.categoryId, { shouldValidate: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit article' : 'Create article'}</DialogTitle>
        </DialogHeader>
        {topError && (
          <p className="text-sm text-destructive">{topErr?.message}</p>
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <DialogBody className="pt-2.5 space-y-6">
              <div
                className={cn(
                  'grid grid-cols-1 gap-6',
                  'md:grid-cols-2',
                )}
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Article headline"
                            {...field}
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
                            rows={3}
                            placeholder="1–2 sentences for list views"
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
                    name="topicId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Topic</FormLabel>
                        <Select
                          onValueChange={(v) => {
                            field.onChange(v);
                            onTopicChange(v);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select topic" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {topics.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
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
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pipeline stage</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PIPELINE_STAGES.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.label}
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
                    name="publishDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Publish date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground">
                          Readiness is auto-set 7 days before this date.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="videoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Video URL (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://www.youtube.com/watch?v=…"
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
                    name="isEditorsChoice"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-2 rounded-md border p-3">
                        <div>
                          <FormLabel>Editor’s choice</FormLabel>
                          <p className="text-[10px] text-muted-foreground">
                            Surfaces the article in featured placements.
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="featuredImage"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <ImageUploadInput
                            label="Featured image"
                            directory="articles"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="galleryImages"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <GalleryUploadInput
                            value={field.value}
                            onChange={field.onChange}
                            directory="galleries"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Write the full article. Use the toolbar to format, add images, or embed a YouTube video."
                      />
                    </FormControl>
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
                  isProcessing ||
                  topics.length === 0 ||
                  !topicIdWatch ||
                  !form.watch('title')?.trim() ||
                  (isEdit && !form.formState.isDirty)
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
