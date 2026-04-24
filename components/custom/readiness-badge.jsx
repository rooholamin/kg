import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const readinessVariants = cva('', {
  variants: {
    readiness: {
      on_track: 'border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
      at_risk: 'border-transparent bg-amber-500/12 text-amber-800 dark:text-amber-200',
      overdue: 'border-transparent bg-destructive/12 text-destructive',
    },
  },
  defaultVariants: { readiness: 'on_track' },
});

const labels = {
  on_track: 'On track',
  at_risk: 'At risk',
  overdue: 'Overdue / breach',
};

export function ReadinessBadge({ readiness, className }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        readinessVariants({ readiness: readiness || 'on_track' }),
        className,
      )}
    >
      {labels[readiness] ?? readiness}
    </Badge>
  );
}
