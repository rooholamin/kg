import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const statusVariants = cva('', {
  variants: {
    variant: {
      active: 'border-transparent bg-primary/10 text-primary',
      archived: 'border-transparent bg-muted text-muted-foreground',
      draft: 'border-transparent bg-secondary text-secondary-foreground',
      inactive: 'border-transparent bg-muted text-muted-foreground',
      not_started: 'border-transparent bg-muted text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'active' },
});

export function StatusBadge({ children, className, variant = 'active' }) {
  return (
    <Badge
      variant="outline"
      className={cn(statusVariants({ variant }), className)}
    >
      {children}
    </Badge>
  );
}
