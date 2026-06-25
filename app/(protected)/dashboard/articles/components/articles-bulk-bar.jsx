'use client';

import { useState } from 'react';
import { CheckCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ArticlesBulkDeleteDialog } from './articles-bulk-delete-dialog';
import { ArticlesBulkApproveDialog } from './articles-bulk-approve-dialog';

/**
 * Sticky bulk-action bar that appears when one or more rows are selected.
 *
 * @param {object}   props
 * @param {object[]} props.selectedRows     - full row objects (original data)
 * @param {() => void} props.onClearSelection
 */
export function ArticlesBulkBar({ selectedRows, onClearSelection }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);

  const count = selectedRows.length;
  const approvalIds = selectedRows
    .filter((r) => r.status === 'approval')
    .map((r) => r.id);
  const allIds = selectedRows.map((r) => r.id);

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/60 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {count}
          </span>
          <span>
            {count} article{count !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {approvalIds.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setApproveOpen(true)}
            >
              <CheckCheck className="me-1.5 size-4" />
              Approve {approvalIds.length > 1 ? `${approvalIds.length} in review` : 'in review'}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="me-1.5 size-4" />
            Delete {count > 1 ? `${count}` : ''}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            aria-label="Clear selection"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <ArticlesBulkDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        ids={allIds}
        onSuccess={onClearSelection}
      />
      <ArticlesBulkApproveDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        ids={approvalIds}
        onSuccess={onClearSelection}
      />
    </>
  );
}
