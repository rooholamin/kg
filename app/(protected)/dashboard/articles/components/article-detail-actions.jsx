'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ArticleFormDialog } from './article-form-dialog';
import { ArticleArchiveDialog } from './article-archive-dialog';

/**
 * @param {object} props
 * @param {object} props.article shape from getArticleById + API mapping
 */
export function ArticleDetailActions({ article }) {
  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link href="/dashboard/articles">Back</Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => setFormOpen(true)}
      >
        <Pencil className="size-4 me-1" />
        Edit
      </Button>
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setArchiveOpen(true)}
      >
        <Trash2 className="size-4 me-1" />
        Delete
      </Button>
      <ArticleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        article={article}
      />
      <ArticleArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        article={article}
        redirectAfter
      />
    </div>
  );
}
