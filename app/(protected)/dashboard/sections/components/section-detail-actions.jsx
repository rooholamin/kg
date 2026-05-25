'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionFormDialog } from './section-form-dialog';
import { SectionArchiveDialog } from './section-archive-dialog';

/**
 * @param {object} props
 * @param {object} props.section
 */
export function SectionDetailActions({ section }) {
  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link href="/dashboard/sections">Back</Link>
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
      <SectionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        section={section}
      />
      <SectionArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        section={section}
        redirectAfter
      />
    </div>
  );
}
