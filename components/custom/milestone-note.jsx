import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

/**
 * Callout for features that activate in a future milestone.
 * TODO: Remove or wire to real behavior when the milestone ships.
 */
export function MilestoneNote({ milestone, children, className, title }) {
  return (
    <Alert className={cn('not-prose', className)}>
      <Info className="size-4" />
      <AlertTitle>
        {title ?? `Activates in Milestone ${milestone}`}
      </AlertTitle>
      {children && (
        <AlertDescription className="text-muted-foreground">
          {children}
        </AlertDescription>
      )}
    </Alert>
  );
}
