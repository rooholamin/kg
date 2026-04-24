'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryFormDialog } from './category-form-dialog';
import { CategoryArchiveDialog } from './category-archive-dialog';

/**
 * @param {object} props
 * @param {{ id: string; name: string; description?: string | null; status: string; topicCount: number; articleCount: number }} props.category
 */
export function CategoryDetailActions({ category }) {
  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link href="/dashboard/categories">Back</Link>
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
        Archive or delete
      </Button>
      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={category}
      />
      <CategoryArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        category={category}
        redirectAfter
      />
    </div>
  );
}
