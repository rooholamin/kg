import { z } from 'zod';

export const ARTICLE_STATUSES = [
  'planning',
  'research',
  'writing',
  'assets',
  'approval',
  'scheduling',
  'publishing',
  'post_publish',
];

export const ArticleFormSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'Title is required.' })
    .max(200, { message: 'Title is too long.' }),
  summary: z.string().max(500).optional().nullable(),
  topicId: z.string().min(1, { message: 'Topic is required.' }),
  categoryId: z.string().min(1, { message: 'Category is required.' }),
  status: z.enum(ARTICLE_STATUSES, { required_error: 'Status is required.' }),
  publishDate: z.string().optional().nullable(),
  featuredImage: z
    .union([z.string().url('Must be a valid URL.'), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v)),
  videoUrl: z
    .union([z.string().url('Must be a valid URL.'), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v)),
  isEditorsChoice: z.boolean().optional().default(false),
  content: z
    .object({ type: z.literal('doc'), content: z.array(z.any()).optional() })
    .passthrough()
    .optional()
    .nullable(),
  galleryImages: z.array(z.string().url()).optional().default([]),
});
