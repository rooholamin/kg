import { z } from 'zod';

export const ProjectBlockerSchema = z.object({
  milestoneId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required.').max(220),
  description: z.string().max(1200).optional().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  status: z.enum(['open', 'resolved']).default('open'),
});

