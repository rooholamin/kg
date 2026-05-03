import { z } from 'zod';

export const ProjectProgressReportSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(180),
  summary: z.string().min(1, 'Summary is required.').max(2000),
  buildProgress: z.number().int().min(0).max(100).optional(),
  automationProgress: z.number().int().min(0).max(100).optional(),
  keyFocus: z.string().max(500).optional().nullable(),
  blockersSummary: z.string().max(1000).optional().nullable(),
});

