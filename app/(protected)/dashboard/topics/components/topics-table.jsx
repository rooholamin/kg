'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Container } from '@/components/common/container';
import { MilestoneNote } from '@/components/custom/milestone-note';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function TopicsTable() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [topicsRes, catRes] = await Promise.all([
          fetch('/api/topics'),
          fetch('/api/categories'),
        ]);
        if (!topicsRes.ok) {
          const j = await topicsRes.json().catch(() => ({}));
          throw new Error(j.message || 'Failed to load topics');
        }
        if (!catRes.ok) {
          const j = await catRes.json().catch(() => ({}));
          throw new Error(j.message || 'Failed to load categories');
        }
        const [topicsJson, catJson] = await Promise.all([
          topicsRes.json(),
          catRes.json(),
        ]);
        if (!cancelled) {
          setRows(topicsJson.data ?? []);
          setCategories(catJson.data ?? []);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((t) => {
      const matchQ =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.targetKeyword ?? '').toLowerCase().includes(q);
      const matchC = catFilter === 'all' || t.categoryId === catFilter;
      return matchQ && matchC;
    });
  }, [search, catFilter, rows]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        id: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader title="Topic" column={column} />
        ),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/dashboard/topics/${row.original.id}`}
          >
            {row.original.name}
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
        id: 'tags',
        header: 'Tags',
        cell: () => (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      },
      {
        id: 'priority',
        header: ({ column }) => (
          <DataGridColumnHeader title="Priority" column={column} />
        ),
        cell: () => <span className="text-sm text-muted-foreground">—</span>,
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
        cell: () => (
          <span className="text-xs text-muted-foreground">Milestone 6</span>
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
        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load topics</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full sm:w-48">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categories.map((c) => (
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
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !loadError && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No topics yet. Create your first in Milestone 3.
          </p>
        ) : !loadError && data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No topics match this filter.
          </p>
        ) : !loadError ? (
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
        ) : null}
      </div>
    </Container>
  );
}
