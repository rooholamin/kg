import { z } from 'zod';

export const ProjectPhaseSchema = z.object({
  slug: z.enum(['build', 'automation']),
  title: z.string().min(1, 'Title is required.').max(160),
  description: z.string().max(1000).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

