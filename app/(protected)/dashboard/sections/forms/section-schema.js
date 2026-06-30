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
  characterBackground: z.string().max(200).optional().nullable(),
  characterRole: z.string().max(500).optional().nullable(),
  characterAge: z.string().max(100).optional().nullable(),
  characterBiography: z.string().max(10000).optional().nullable(),
  characterTone: z.string().max(500).optional().nullable(),
  characterWritingStyle: z.string().max(10000).optional().nullable(),
  characterSampleVoice: z.string().max(5000).optional().nullable(),
  characterPersona: z.string().max(10000).optional().nullable(),
  characterImage: z.string().max(500).optional().nullable(),
  // WordPress integration
  wpSiteUrl: z.string().url({ message: 'Must be a valid URL.' }).max(500).optional().nullable().or(z.literal('')),
  wpUsername: z.string().max(200).optional().nullable(),
  wpAppPassword: z.string().max(500).optional().nullable(),
  wpAuthorId: z.coerce.number().int().positive().optional().nullable(),
  // Social media colors
  colorAccent: z.string().max(20).optional().nullable(),
  colorLight: z.string().max(20).optional().nullable(),
  colorDark: z.string().max(20).optional().nullable(),
  // Social hashtags (stored as array)
  socialHashtags: z.array(z.string().max(100)).default([]),
});
