import { z } from 'zod';

export const ProjectWorkstreamSchema = z.object({
  phaseId: z.string().min(1, 'Phase is required.'),
  name: z.string().min(1, 'Name is required.').max(200),
  description: z.string().max(1000).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

