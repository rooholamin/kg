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
import { StatusBadge } from '@/components/custom/status-badge';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { MOCK_TOPICS, MOCK_CATEGORIES } from '@/app/(protected)/dashboard/_mock';
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ChevronRight } from 'lucide-react';

export function TopicsTable() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });

  const data = useMemo(() => {
    const q = search.toLowerCase();
    return MOCK_TOPICS.filter((t) => {
      const matchQ =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.targetKeyword.toLowerCase().includes(q);
      const matchC =
        catFilter === 'all' || t.categoryId === catFilter;
      return matchQ && matchC;
    });
  }, [search, catFilter]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        id: 'title',
        header: ({ column }) => (
          <DataGridColumnHeader title="Topic" column={column} />
        ),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/dashboard/topics/${row.original.id}`}
          >
            {row.original.title}
          </Link>
        ),
        size: 200,
      },
      {
        accessorKey: 'categoryName',
        id: 'categoryName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Category" column={column} />
        ),
        cell: ({ row }) => <Badge variant="secondary">{row.original.categoryName}</Badge>,
        size: 120,
      },
      {
        accessorKey: 'targetKeyword',
        id: 'targetKeyword',
        header: ({ column }) => (
          <DataGridColumnHeader title="Target keyword" column={column} />
        ),
        size: 160,
      },
      {
        accessorKey: 'tags',
        id: 'tags',
        header: 'Tags',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.tags?.join(', ')}
          </span>
        ),
      },
      {
        accessorKey: 'priority',
        id: 'priority',
        header: ({ column }) => (
          <DataGridColumnHeader title="Priority" column={column} />
        ),
        cell: ({ getValue }) => (
          <span className="capitalize text-sm">{getValue()}</span>
        ),
        size: 100,
      },
      {
        accessorKey: 'status',
        id: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        cell: ({ getValue }) => {
          const v = getValue();
          return (
            <StatusBadge variant={v === 'active' ? 'active' : 'draft'}>
              {v}
            </StatusBadge>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'articleCount',
        id: 'articleCount',
        header: 'Articles',
        size: 80,
      },
      {
        id: 'readiness',
        header: 'Readiness',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[140px]">
            {row.original.readinessSummary}
          </span>
        ),
        size: 160,
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
      <MilestoneNote milestone={3}>Real topic CRUD in Milestone 3</MilestoneNote>
      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full sm:w-48">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
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
        </div>
        <MockTableToolbar
          search={search}
          onSearchChange={setSearch}
          actionLabel="New topic (M3)"
          onAction={() => {}}
        />
        <Card>
          <DataGrid
            table={table}
            recordCount={data.length}
            onRowClick={(row) => router.push(`/dashboard/topics/${row.id}`)}
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
