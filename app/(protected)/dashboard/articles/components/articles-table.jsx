'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { MOCK_ARTICLES, MOCK_CATEGORIES, PIPELINE_STAGES } from '@/app/(protected)/dashboard/_mock';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { ReadinessBadge } from '@/components/custom/readiness-badge';
import { PipelineStageBadge } from '@/components/custom/pipeline-stage-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ArticlesTable() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [readiness, setReadiness] = useState('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });

  const data = useMemo(() => {
    const q = search.toLowerCase();
    return MOCK_ARTICLES.filter((a) => {
      if (q && !a.title.toLowerCase().includes(q)) return false;
      if (stage !== 'all' && a.stage !== stage) return false;
      if (categoryId !== 'all' && a.categoryId !== categoryId) return false;
      if (readiness !== 'all' && a.readiness !== readiness) return false;
      return true;
    });
  }, [search, stage, categoryId, readiness]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        id: 'title',
        header: ({ column }) => (
          <DataGridColumnHeader title="Title" column={column} />
        ),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/dashboard/articles/${row.original.id}`}
          >
            {row.original.title}
          </Link>
        ),
        size: 240,
      },
      {
        accessorKey: 'topicTitle',
        id: 'topic',
        header: 'Topic',
        size: 140,
      },
      {
        accessorKey: 'categoryName',
        id: 'cat',
        header: 'Category',
        cell: ({ getValue }) => <Badge variant="secondary">{getValue()}</Badge>,
        size: 100,
      },
      {
        accessorKey: 'stage',
        id: 'stage',
        header: 'Stage',
        cell: ({ getValue }) => <PipelineStageBadge stage={getValue()} />,
        size: 120,
      },
      {
        accessorKey: 'publishDate',
        id: 'publish',
        header: 'Publish',
        size: 100,
      },
      {
        accessorKey: 'readinessDeadline',
        id: 'readyBy',
        header: 'Ready by',
        size: 100,
      },
      {
        accessorKey: 'readiness',
        id: 'readiness',
        header: 'Readiness',
        cell: ({ getValue }) => <ReadinessBadge readiness={getValue()} />,
        size: 120,
      },
      {
        id: 'assignee',
        header: 'Assignee',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">
                {row.original.assignee?.initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{row.original.assignee?.name}</span>
          </div>
        ),
        size: 160,
      },
      {
        accessorKey: 'seoScore',
        id: 'seo',
        header: 'SEO',
        size: 64,
      },
      {
        accessorKey: 'wordpressStatus',
        id: 'wp',
        header: 'WordPress',
        size: 120,
      },
      {
        id: 'go',
        header: '',
        cell: () => <ChevronRight className="size-4 text-muted-foreground" />,
        size: 32,
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => r.id,
  });

  return (
    <Container>
      <MilestoneNote milestone={4}>Full article engine in Milestone 4</MilestoneNote>
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {MOCK_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Readiness</Label>
            <Select value={readiness} onValueChange={setReadiness}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="on_track">On track</SelectItem>
                <SelectItem value="at_risk">At risk</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <MockTableToolbar
          search={search}
          onSearchChange={setSearch}
          actionLabel="New article (M4)"
          onAction={() => {}}
          placeholder="Search title…"
        />
        <Card>
          <DataGrid
            table={table}
            recordCount={data.length}
            onRowClick={(row) => router.push(`/dashboard/articles/${row.id}`)}
          >
            <CardTable>
              <ScrollArea>
                <DataGridTable table={table} />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardTable>
            <CardFooter>
              <DataGridPagination className="py-0" />
            </CardFooter>
          </DataGrid>
        </Card>
      </div>
    </Container>
  );
}
