import { z } from 'zod';

export const SectionFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Name is required.' })
    .max(200, { message: 'Name is too long.' }),
  slug: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  status: z.enum(['active', 'archived'], {
    required_error: 'Status is required.',
  }),
  characterName: z
    .string()
    .min(1, { message: 'Character name is required.' })
    .max(200),
  characterBiography: z.string().max(5000).optional().nullable(),
  characterPersona: z.string().max(5000).optional().nullable(),
  characterImage: z
    .string()
    .max(500)
    .optional()
    .nullable(),
});
