'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TopicFormDialog } from './topic-form-dialog';
import { TopicArchiveDialog } from './topic-archive-dialog';

/**
 * @param {object} props
 * @param {{ id: string; name: string; description?: string | null; categoryId: string; targetKeyword?: string | null; status: string; articleCount: number }} props.topic
 */
export function TopicDetailActions({ topic }) {
  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link href="/dashboard/topics">Back</Link>
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
      <TopicFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        topic={topic}
      />
      <TopicArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        topic={topic}
        redirectAfter
      />
    </div>
  );
}
