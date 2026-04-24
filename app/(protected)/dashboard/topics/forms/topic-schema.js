import { z } from 'zod';

export const TopicFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name is required.' })
    .max(200, { message: 'Name is too long.' }),
  description: z.string().max(2000).optional().nullable(),
  categoryId: z.string().min(1, { message: 'Category is required.' }),
  targetKeyword: z.string().max(200).optional().nullable(),
  status: z.enum(['active', 'archived'], {
    required_error: 'Status is required.',
  }),
});
