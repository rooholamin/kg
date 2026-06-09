import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Light toolbar shell for list pages — search is local filter only in M1.
 * Pass `secondaryAction` to render an extra button between the search and the primary action.
 */
export function MockTableToolbar({
  search,
  onSearchChange,
  actionLabel = 'New',
  onAction,
  placeholder = 'Search…',
  secondaryAction,
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
      <div className="relative max-w-md flex-1">
        <Search className="size-4 text-muted-foreground absolute start-2.5 top-1/2 -translate-y-1/2" />
        <Input
          className="ps-8"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {secondaryAction}
        {actionLabel && (
          <Button onClick={onAction} type="button">
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
