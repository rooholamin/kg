import { z } from 'zod';

export const CategoryFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name is required.' })
    .max(200, { message: 'Name is too long.' }),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'archived'], {
    required_error: 'Status is required.',
  }),
  sectionId: z.string().min(1, { message: 'Section is required.' }).nullable().optional(),
});
