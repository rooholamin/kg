import { z } from 'zod';

export const ProjectMilestoneSchema = z.object({
  workstreamId: z.string().min(1, 'Workstream is required.'),
  title: z.string().min(1, 'Title is required.').max(220),
  description: z.string().max(1200).optional().nullable(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
  type: z.enum(['build', 'automation']),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  progressPercent: z.number().int().min(0).max(100),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

