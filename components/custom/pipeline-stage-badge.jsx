import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const stageToClass = {
  planning: 'bg-sky-500/12 text-sky-800 dark:text-sky-200',
  research: 'bg-sky-500/12 text-sky-800 dark:text-sky-200',
  writing: 'bg-sky-500/12 text-sky-800 dark:text-sky-200',
  assets: 'bg-violet-500/12 text-violet-800 dark:text-violet-200',
  review: 'bg-amber-500/12 text-amber-800 dark:text-amber-200',
  approval: 'bg-amber-500/12 text-amber-800 dark:text-amber-200',
  scheduling: 'bg-violet-500/12 text-violet-800 dark:text-violet-200',
  publishing: 'bg-orange-500/12 text-orange-800 dark:text-orange-200',
  post_publish: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200',
};

const pretty = {
  planning: 'Planning',
  research: 'Research',
  writing: 'Writing',
  assets: 'Asset Gen',
  review: 'Review',
  approval: 'Approval',
  scheduling: 'Scheduling',
  publishing: 'Publishing',
  post_publish: 'Post-Publish',
};

export function PipelineStageBadge({ stage, className }) {
  const cls = stageToClass[stage] ?? 'bg-muted text-muted-foreground';
  return (
    <Badge
      variant="outline"
      size="fluid"
      className={cn('border-transparent', cls, 'w-fit max-w-full', className)}
    >
      {pretty[stage] ?? stage}
    </Badge>
  );
}
