'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card, CardFooter, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/custom/status-badge';
import { MockTableToolbar } from '@/app/(protected)/dashboard/components/mock-table-toolbar';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CategoryFormDialog } from './category-form-dialog';
import { CategoryArchiveDialog } from './category-archive-dialog';
import { cn } from '@/lib/utils';

async function fetchCategories() {
  const res = await apiFetch('/api/categories');
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || 'Failed to load categories');
  }
  return res.json();
}

export function CategoriesTable() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 8 });
  const [formOpen, setFormOpen] = useState(false);
  const [formCategory, setFormCategory] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveCategory, setArchiveCategory] = useState(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const rows = data?.data ?? [];

  const dataFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q) ||
        (c.section?.name ?? '').toLowerCase().includes(q),
    );
  }, [search, rows]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        id: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader title="Name" column={column} />
        ),
        cell: ({ row }) => (
          <Link
            className="font-medium text-primary hover:underline"
            href={`/dashboard/categories/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.name}
          </Link>
        ),
        size: 200,
      },
      {
        accessorKey: 'section',
        id: 'section',
        header: ({ column }) => (
          <DataGridColumnHeader title="Section" column={column} />
        ),
        cell: ({ row }) => {
          const s = row.original.section;
          if (!s) return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <Link
              className="text-xs text-primary hover:underline"
              href={`/dashboard/sections/${s.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              {s.name}
            </Link>
          );
        },
        size: 140,
      },
      {
        accessorKey: 'description',
        id: 'description',
        header: ({ column }) => (
          <DataGridColumnHeader title="Description" column={column} />
        ),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground line-clamp-2 max-w-md">
            {getValue() ?? '—'}
          </span>
        ),
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
            <StatusBadge
              variant={v === 'active' ? 'active' : 'archived'}
              className={cn(
                v === 'archived' && 'opacity-80',
              )}
            >
              {v}
            </StatusBadge>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'topicCount',
        id: 'topicCount',
        header: ({ column }) => (
          <DataGridColumnHeader title="Topics" column={column} />
        ),
        size: 80,
      },
      {
        accessorKey: 'articleCount',
        id: 'articleCount',
        header: ({ column }) => (
          <DataGridColumnHeader title="Articles" column={column} />
        ),
        size: 80,
      },
      {
        accessorKey: 'createdAt',
        id: 'createdAt',
        header: ({ column }) => (
          <DataGridColumnHeader title="Created" column={column} />
        ),
        cell: ({ getValue }) => format(parseISO(getValue()), 'PP'),
        size: 120,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Edit"
                onClick={() => {
                  setFormCategory(r);
                  setFormOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                aria-label="Archive or delete"
                onClick={() => {
                  setArchiveCategory(r);
                  setArchiveOpen(true);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        },
        size: 100,
      },
      {
        id: 'go',
        header: '',
        cell: () => <ChevronRight className="size-4 text-muted-foreground" />,
        size: 40,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: dataFiltered,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (r) => r.id,
  });

  const loadError = isError ? error?.message : null;
  const showSkeleton = isLoading;
  const showTable = !loadError && !isLoading;

  return (
    <Container>
      <div className="mt-4">
        {loadError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load categories</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {loadError}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <CategoryFormDialog
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setFormCategory(null);
          }}
          category={formCategory}
        />
        <CategoryArchiveDialog
          open={archiveOpen}
          onOpenChange={(o) => {
            setArchiveOpen(o);
            if (!o) setArchiveCategory(null);
          }}
          category={archiveCategory}
        />

        <MockTableToolbar
          search={search}
          onSearchChange={setSearch}
          actionLabel="Create category"
          onAction={() => {
            setFormCategory(null);
            setFormOpen(true);
          }}
          placeholder="Filter categories"
        />
        {isFetching && !isLoading && (
          <p className="text-xs text-muted-foreground mb-2">Refreshing…</p>
        )}

        {showSkeleton ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !loadError && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No categories yet.{' '}
            <button
              type="button"
              className="text-primary underline font-medium"
              onClick={() => {
                setFormCategory(null);
                setFormOpen(true);
              }}
            >
              Create your first category
            </button>
            .
          </p>
        ) : !loadError && dataFiltered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
            No categories match this filter.
          </p>
        ) : showTable ? (
          <Card>
            <DataGrid
              table={table}
              recordCount={dataFiltered.length}
              onRowClick={(row) => router.push(`/dashboard/categories/${row.id}`)}
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
